import type { TSESTree } from '@typescript-eslint/typescript-estree';
import type { RuleMatch, MigrationRule } from '../../shared/types/rule.js';

/** 규칙 실행 시 전달되는 컨텍스트 */
export interface RuleContext {
  filePath: string;
  content: string;
  lines: string[];
  /** AST 파싱 실패 시 null — requiresAST: true 규칙은 이 경우 건너뜀 */
  ast: TSESTree.Program | null;
  currentNodeVersion: string | null;
  targetNodeVersion: string;
}

/** 규칙 구현체 인터페이스 */
export interface RuleImplementation extends MigrationRule {
  /**
   * AST 파싱 결과가 반드시 필요한 규칙 여부.
   * true: AST 파싱 실패 시 규칙 건너뜀 (기본값)
   * false: AST 없이도 content(텍스트) 기반으로 실행 가능
   */
  requiresAST?: boolean;
  /** 코드에서 이슈 감지 */
  detect(context: RuleContext): RuleMatch[];
  /** 전체 파일에 자동 수정 적용 (선택적) */
  fix?(content: string, matches: RuleMatch[]): string;
}
