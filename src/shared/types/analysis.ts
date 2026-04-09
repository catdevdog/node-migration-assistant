import type { RuleMatch } from './rule.js';

/** 단일 파일 분석 결과 */
export interface FileAnalysisResult {
  filePath: string;
  matches: RuleMatch[];
  /** 자동 수정 적용 후 코드 (있을 경우) */
  fixedContent?: string;
  /** 분석 소요 시간 (ms) */
  duration: number;
  summary: {
    total: number;
    fixable: number;
    needsAI: number;
    errors: number;
    warnings: number;
    infos: number;
  };
}

/** 배치 분석 진행 상황 */
export interface BatchAnalysisProgress {
  current: number;
  total: number;
  currentFile: string;
  results: FileAnalysisResult[];
}
