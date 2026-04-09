/** 규칙 카테고리 */
export type RuleCategory = 'node-api' | 'es-syntax' | 'dependency' | 'config';

/** 규칙 심각도 */
export type RuleSeverity = 'error' | 'warning' | 'info';

/** 규칙 매치 결과 */
export interface RuleMatch {
  ruleId: string;
  ruleName: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  message: string;
  severity: RuleSeverity;
  /** 자동 수정 가능 여부 */
  fixable: boolean;
  /** 수정 제안 코드 */
  suggestedFix?: string;
  /** AI 에스컬레이션 필요 여부 */
  needsAI?: boolean;
  /** AI 에스컬레이션 이유 */
  aiReason?: string;
}

/** 규칙 정의 인터페이스 */
export interface MigrationRule {
  id: string;
  name: string;
  description: string;
  category: RuleCategory;
  severity: RuleSeverity;
  /** 이 규칙이 적용되는 최소 목표 Node 버전 (예: "16") */
  minTargetVersion?: string;
  /** 분석 대상 파일 확장자 */
  fileExtensions: string[];
}
