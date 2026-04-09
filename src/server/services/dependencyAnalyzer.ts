import fs from 'fs/promises';
import path from 'path';
import semver from 'semver';
import type { DepInfo, DependencyAnalysisResult } from '../../shared/types/dependency.js';
import type { RiskLevel } from '../../shared/constants.js';
import { logger } from '../utils/logger.js';

interface NpmRegistryInfo {
  'dist-tags'?: { latest?: string };
  versions?: Record<string, { engines?: { node?: string } }>;
}

/** npm registry에서 패키지 정보 가져오기 */
async function fetchPackageInfo(name: string): Promise<NpmRegistryInfo | null> {
  try {
    const encodedName = encodeURIComponent(name).replace('%40', '@');
    const response = await fetch(
      `https://registry.npmjs.org/${encodedName}`,
      {
        headers: { Accept: 'application/vnd.npm.install-v1+json' },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) return null;
    return (await response.json()) as NpmRegistryInfo;
  } catch {
    logger.warn(`npm registry 조회 실패: ${name}`);
    return null;
  }
}

/** 패키지의 최신 버전에서 engines.node 가져오기 */
async function fetchLatestEngines(name: string): Promise<{
  latestVersion: string | null;
  enginesNode: string | null;
}> {
  const info = await fetchPackageInfo(name);
  if (!info) return { latestVersion: null, enginesNode: null };

  const latestVersion = info['dist-tags']?.latest ?? null;
  let enginesNode: string | null = null;

  if (latestVersion && info.versions?.[latestVersion]?.engines?.node) {
    enginesNode = info.versions[latestVersion].engines!.node!;
  }

  return { latestVersion, enginesNode };
}

/** 위험 등급 판정 */
function assessRisk(params: {
  currentVersion: string;
  latestVersion: string | null;
  enginesNode: string | null;
  targetNodeVersion: string;
  cveCount: number;
}): { level: RiskLevel; reason: string; recommendation: string } {
  const { currentVersion, latestVersion, enginesNode, targetNodeVersion, cveCount } = params;
  const targetMajor = `${targetNodeVersion}.0.0`;

  // CVE가 있으면 위험
  if (cveCount > 0) {
    return {
      level: 'danger',
      reason: `보안 취약점 ${cveCount}건 발견`,
      recommendation: latestVersion
        ? `${latestVersion}으로 업그레이드 후 재검사`
        : '대체 라이브러리 검토 필요',
    };
  }

  // engines.node가 목표 버전과 비호환
  if (enginesNode) {
    try {
      if (!semver.satisfies(targetMajor, enginesNode)) {
        return {
          level: 'danger',
          reason: `engines.node "${enginesNode}" — Node ${targetNodeVersion}과 비호환`,
          recommendation: latestVersion
            ? `최신 버전(${latestVersion}) 호환 여부 확인`
            : '대체 라이브러리 검토 필요',
        };
      }
    } catch {
      // 파싱 실패 시 경고로 처리
    }
  }

  // engines.node 미선언
  if (!enginesNode && latestVersion) {
    // major 버전 차이 확인
    const currentClean = semver.coerce(currentVersion);
    const latestClean = semver.coerce(latestVersion);

    if (currentClean && latestClean) {
      const majorDiff = latestClean.major - currentClean.major;

      if (majorDiff >= 2) {
        return {
          level: 'warning',
          reason: `major 버전 ${majorDiff}단계 뒤처짐 (${currentVersion} → ${latestVersion})`,
          recommendation: `${latestVersion}으로 업그레이드 권장`,
        };
      }

      if (majorDiff >= 1) {
        return {
          level: 'review',
          reason: `major 업데이트 가능 (${currentVersion} → ${latestVersion})`,
          recommendation: `변경 사항 확인 후 업그레이드 검토`,
        };
      }
    }

    return {
      level: 'review',
      reason: 'engines.node 미선언 — 호환성 미확인',
      recommendation: '수동 확인 권장',
    };
  }

  // 최신 버전과 동일하거나 근접
  if (latestVersion) {
    const currentClean = semver.coerce(currentVersion);
    const latestClean = semver.coerce(latestVersion);

    if (currentClean && latestClean && semver.lt(currentClean, latestClean)) {
      const majorDiff = latestClean.major - currentClean.major;
      if (majorDiff >= 2) {
        return {
          level: 'warning',
          reason: `major 버전 ${majorDiff}단계 뒤처짐`,
          recommendation: `${latestVersion}으로 업그레이드 권장`,
        };
      }
      if (majorDiff >= 1) {
        return {
          level: 'review',
          reason: `major 업데이트 가능 (${currentVersion} → ${latestVersion})`,
          recommendation: '변경 사항 확인 후 업그레이드 검토',
        };
      }
    }
  }

  return {
    level: 'safe',
    reason: '호환 확인됨',
    recommendation: '조치 불필요',
  };
}

/** package.json에서 의존성 목록 추출 */
function extractDeps(
  pkg: Record<string, unknown>,
): Array<{ name: string; version: string; isDev: boolean }> {
  const result: Array<{ name: string; version: string; isDev: boolean }> = [];

  const deps = pkg.dependencies as Record<string, string> | undefined;
  const devDeps = pkg.devDependencies as Record<string, string> | undefined;

  if (deps) {
    for (const [name, version] of Object.entries(deps)) {
      result.push({ name, version, isDev: false });
    }
  }
  if (devDeps) {
    for (const [name, version] of Object.entries(devDeps)) {
      result.push({ name, version, isDev: true });
    }
  }

  return result;
}

/** 의존성 분석 메인 함수 */
export async function analyzeDependencies(
  projectPath: string,
  targetNodeVersion: string,
  auditVulnMap?: Map<string, number>,
): Promise<DependencyAnalysisResult> {
  // package.json 읽기
  const pkgPath = path.join(projectPath, 'package.json');
  const raw = await fs.readFile(pkgPath, 'utf-8');
  const pkg = JSON.parse(raw) as Record<string, unknown>;

  const depList = extractDeps(pkg);
  logger.info(`의존성 ${depList.length}개 분석 시작 (목표: Node ${targetNodeVersion})`);

  // 병렬로 npm registry 조회 (동시 5개씩 배치)
  const BATCH_SIZE = 5;
  const results: DepInfo[] = [];

  for (let i = 0; i < depList.length; i += BATCH_SIZE) {
    const batch = depList.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (dep) => {
        const { latestVersion, enginesNode } = await fetchLatestEngines(dep.name);
        const cveCount = auditVulnMap?.get(dep.name) ?? 0;

        const { level, reason, recommendation } = assessRisk({
          currentVersion: dep.version,
          latestVersion,
          enginesNode,
          targetNodeVersion,
          cveCount,
        });

        const info: DepInfo = {
          name: dep.name,
          currentVersion: dep.version,
          latestVersion,
          enginesNode,
          riskLevel: level,
          riskReason: reason,
          cveCount,
          recommendation,
          isDev: dep.isDev,
        };

        return info;
      }),
    );

    results.push(...batchResults);
  }

  // 위험도 높은 순 정렬
  const riskOrder: Record<RiskLevel, number> = { danger: 0, warning: 1, review: 2, safe: 3 };
  results.sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel]);

  const summary = {
    total: results.length,
    danger: results.filter((d) => d.riskLevel === 'danger').length,
    warning: results.filter((d) => d.riskLevel === 'warning').length,
    review: results.filter((d) => d.riskLevel === 'review').length,
    safe: results.filter((d) => d.riskLevel === 'safe').length,
  };

  logger.info(
    `분석 완료: 🔴 ${summary.danger} / 🟠 ${summary.warning} / 🟡 ${summary.review} / 🟢 ${summary.safe}`,
  );

  return { dependencies: results, audit: null, summary };
}
