import type { TSESTree } from '@typescript-eslint/typescript-estree';
import type { RuleMatch, MigrationRule } from '../../shared/types/rule.js';

/** 규칙 실행 시 전달되는 컨텍스트 */
export interface RuleContext {
  filePath: string;
  content: string;
  lines: string[];
  ast: TSESTree.Program;
  currentNodeVersion: string | null;
  targetNodeVersion: string;
}

/** 규칙 구현체 인터페이스 */
export interface RuleImplementation extends MigrationRule {
  /** 코드에서 이슈 감지 */
  detect(context: RuleContext): RuleMatch[];
  /** 전체 파일에 자동 수정 적용 (선택적) */
  fix?(content: string, matches: RuleMatch[]): string;
}
