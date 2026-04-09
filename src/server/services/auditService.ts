import { execa } from 'execa';
import type { AuditResult, AuditVulnerability } from '../../shared/types/dependency.js';
import { logger } from '../utils/logger.js';

/** npm audit --json 실행 후 결과 파싱 */
export async function runAudit(projectPath: string): Promise<AuditResult> {
  logger.info('npm audit 실행 중...');

  let stdout = '';
  try {
    const result = await execa('npm', ['audit', '--json'], {
      cwd: projectPath,
      reject: false, // audit 결과가 있으면 exit code 1이므로 reject 안 함
      timeout: 30000,
    });
    stdout = result.stdout;
  } catch (err) {
    logger.warn('npm audit 실행 실패 — lock 파일이 없거나 npm이 설치되지 않았습니다.');
    return {
      vulnerabilities: [],
      summary: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 },
    };
  }

  if (!stdout.trim()) {
    return {
      vulnerabilities: [],
      summary: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 },
    };
  }

  try {
    const parsed = JSON.parse(stdout);
    return parseAuditOutput(parsed);
  } catch {
    logger.warn('npm audit JSON 파싱 실패');
    return {
      vulnerabilities: [],
      summary: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 },
    };
  }
}

/** npm audit JSON 출력을 파싱 */
function parseAuditOutput(data: Record<string, unknown>): AuditResult {
  const vulnerabilities: AuditVulnerability[] = [];
  const summary = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 };

  // npm audit v2+ 형식 (vulnerabilities 객체)
  const vulns = data.vulnerabilities as Record<string, {
    name?: string;
    severity?: string;
    title?: string;
    url?: string;
    range?: string;
    fixAvailable?: boolean | { name: string; version: string };
    via?: Array<{ title?: string; url?: string; severity?: string }> | string[];
  }> | undefined;

  if (vulns) {
    for (const [name, vuln] of Object.entries(vulns)) {
      const severity = (vuln.severity ?? 'info') as AuditVulnerability['severity'];

      // via에서 상세 정보 추출
      let title = `${name} 취약점`;
      let url = '';
      if (Array.isArray(vuln.via)) {
        const firstVia = vuln.via[0];
        if (typeof firstVia === 'object' && firstVia !== null) {
          title = firstVia.title ?? title;
          url = firstVia.url ?? '';
        }
      }

      vulnerabilities.push({
        name,
        severity,
        title,
        url,
        range: vuln.range ?? '*',
        fixAvailable: typeof vuln.fixAvailable === 'boolean'
          ? vuln.fixAvailable
          : vuln.fixAvailable != null,
      });

      // 심각도별 카운트
      if (severity in summary) {
        summary[severity as keyof typeof summary]++;
      }
      summary.total++;
    }
  }

  // 레거시 형식 (metadata.vulnerabilities)
  const metadata = data.metadata as { vulnerabilities?: Record<string, number> } | undefined;
  if (metadata?.vulnerabilities && summary.total === 0) {
    const v = metadata.vulnerabilities;
    summary.info = v.info ?? 0;
    summary.low = v.low ?? 0;
    summary.moderate = v.moderate ?? 0;
    summary.high = v.high ?? 0;
    summary.critical = v.critical ?? 0;
    summary.total = v.total ?? (summary.info + summary.low + summary.moderate + summary.high + summary.critical);
  }

  logger.info(`npm audit 완료: 총 ${summary.total}건 (critical: ${summary.critical}, high: ${summary.high})`);

  return { vulnerabilities, summary };
}

/** audit 결과에서 패키지별 CVE 건수 맵 생성 */
export function buildVulnMap(audit: AuditResult): Map<string, number> {
  const map = new Map<string, number>();
  for (const vuln of audit.vulnerabilities) {
    map.set(vuln.name, (map.get(vuln.name) ?? 0) + 1);
  }
  return map;
}
