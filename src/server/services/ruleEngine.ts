import path from 'path';
import semver from 'semver';
import { parseCode } from './astService.js';
import { getRulesForFile } from '../rules/registry.js';
import { readFile } from './fileService.js';
import { ANALYZABLE_EXTENSIONS } from '../../shared/constants.js';
import type { FileAnalysisResult } from '../../shared/types/analysis.js';
import type { RuleMatch } from '../../shared/types/rule.js';
import type { RuleContext } from '../rules/types.js';
import type { RuleImplementation } from '../rules/types.js';
import { logger } from '../utils/logger.js';

/** 단일 파일 분석 */
export async function analyzeFile(
  projectRoot: string,
  relativePath: string,
  currentNodeVersion: string | null,
  targetNodeVersion: string,
): Promise<FileAnalysisResult> {
  const start = Date.now();
  const allMatches: RuleMatch[] = [];

  // 확장자 필터 — 분석 대상이 아닌 파일은 즉시 빈 결과 반환
  const ext = path.extname(relativePath).toLowerCase();
  if (!ANALYZABLE_EXTENSIONS.includes(ext)) {
    return buildResult(relativePath, [], undefined, Date.now() - start);
  }

  // 파일 읽기
  const { content } = await readFile(projectRoot, relativePath);

  // AST 파싱 (실패해도 regex 기반 규칙은 계속 실행)
  const parsed = parseCode(content, relativePath);

  // 적용 가능한 규칙 필터링 (확장자 + 타겟 버전)
  const allRules = getRulesForFile(relativePath);
  const rules = allRules.filter((rule) => isRuleApplicable(rule, targetNodeVersion));

  // 규칙 컨텍스트 생성 — AST 파싱 실패 시 ast: null
  const context: RuleContext = {
    filePath: relativePath,
    content,
    lines: parsed ? parsed.lines : content.split('\n'),
    ast: parsed ? parsed.ast : null,
    currentNodeVersion,
    targetNodeVersion,
  };

  // 각 규칙 실행
  for (const rule of rules) {
    // requiresAST가 명시적으로 false가 아닌 규칙(기본: AST 필요)은
    // 파싱 실패 시 건너뜀
    if (rule.requiresAST !== false && !parsed) {
      continue;
    }
    try {
      const matches = rule.detect(context);
      allMatches.push(...matches);
    } catch (err) {
      logger.warn(`규칙 ${rule.id} 실행 실패 (${relativePath}): ${(err as Error).message}`);
    }
  }

  // 자동 수정 생성
  let fixedContent: string | undefined;
  const fixableMatches = allMatches.filter((m) => m.fixable);

  if (fixableMatches.length > 0) {
    fixedContent = content;
    for (const rule of rules) {
      if (rule.fix) {
        const ruleMatches = fixableMatches.filter((m) => m.ruleId === rule.id);
        if (ruleMatches.length > 0) {
          try {
            fixedContent = rule.fix(fixedContent, ruleMatches);
          } catch (err) {
            logger.warn(`규칙 ${rule.id} 수정 실패: ${(err as Error).message}`);
          }
        }
      }
    }
    // 수정 전후가 같으면 제거
    if (fixedContent === content) fixedContent = undefined;
  }

  return buildResult(relativePath, allMatches, fixedContent, Date.now() - start);
}

/** 규칙의 minTargetVersion이 현재 타겟 버전 이하인지 확인 */
function isRuleApplicable(rule: RuleImplementation, targetNodeVersion: string): boolean {
  if (!rule.minTargetVersion) return true;

  // major 버전 비교 (예: '20' >= '20' → true, '18' >= '20' → false)
  const targetMajor = semver.coerce(targetNodeVersion);
  const minMajor = semver.coerce(rule.minTargetVersion);

  if (!targetMajor || !minMajor) return true;

  return semver.gte(targetMajor, minMajor);
}

function buildResult(
  filePath: string,
  matches: RuleMatch[],
  fixedContent: string | undefined,
  duration: number,
): FileAnalysisResult {
  return {
    filePath,
    matches,
    fixedContent,
    duration,
    summary: {
      total: matches.length,
      fixable: matches.filter((m) => m.fixable).length,
      needsAI: matches.filter((m) => m.needsAI).length,
      errors: matches.filter((m) => m.severity === 'error').length,
      warnings: matches.filter((m) => m.severity === 'warning').length,
      infos: matches.filter((m) => m.severity === 'info').length,
    },
  };
}
