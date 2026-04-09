import path from 'path';
import { parseCode } from './astService.js';
import { getRulesForFile } from '../rules/registry.js';
import { readFile } from './fileService.js';
import type { FileAnalysisResult } from '../../shared/types/analysis.js';
import type { RuleMatch } from '../../shared/types/rule.js';
import type { RuleContext } from '../rules/types.js';
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

  // 파일 읽기
  const { content } = await readFile(projectRoot, relativePath);

  // AST 파싱
  const parsed = parseCode(content, relativePath);
  if (!parsed) {
    return buildResult(relativePath, [], undefined, Date.now() - start);
  }

  // 적용 가능한 규칙 필터링
  const rules = getRulesForFile(relativePath);

  // 규칙 컨텍스트 생성
  const context: RuleContext = {
    filePath: relativePath,
    content,
    lines: parsed.lines,
    ast: parsed.ast,
    currentNodeVersion,
    targetNodeVersion,
  };

  // 각 규칙 실행
  for (const rule of rules) {
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
