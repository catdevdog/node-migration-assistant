/** AI 요청 유형 */
export type AIRequestType =
  | 'analyze'           // AI-02: 애매한 코드 분석
  | 'rewrite'           // AI-03: 전체 파일 재작성
  | 'replace-library'   // AI-04: 라이브러리 교체 제안
  | 'cascade'           // AI-05: 연쇄 컴포넌트 영향 분석
  | 'explain-error'     // AI-06: 빌드/런타임 에러 설명
  | 'suggest-improvements' // AI-07: 사전 개선 제안
  | 'dependency';       // AI-08: 의존성 호환성 분석

/** AI 분석 요청 */
export interface AIAnalyzeRequest {
  filePath: string;
  content: string;
  matches: { ruleId: string; line: number; message: string; aiReason?: string }[];
  currentNodeVersion?: string;
  targetNodeVersion?: string;
}

/** AI 파일 재작성 요청 */
export interface AIRewriteRequest {
  filePath: string;
  content: string;
  instructions?: string;
  currentNodeVersion?: string;
  targetNodeVersion?: string;
}

/** AI 라이브러리 교체 요청 */
export interface AIReplaceLibraryRequest {
  libraryName: string;
  currentVersion: string;
  filePath: string;
  content: string;
  recommendation?: string;
}

/** AI 연쇄 영향 분석 요청 */
export interface AICascadeRequest {
  filePath: string;
  changedContent: string;
  originalContent: string;
  relatedFiles: { path: string; content: string }[];
}

/** AI 의존성 호환성 분석 요청 */
export interface AIDependencyRequest {
  /** 분석할 패키지들 (위험 패키지만 선별 전달) */
  packages: {
    name: string;
    currentVersion: string;
    latestVersion: string | null;
    enginesNode: string | null;
    riskLevel: string;
    riskReason: string;
    cveCount: number;
    hasNativeAddon?: boolean;
  }[];
  currentNodeVersion?: string;
  targetNodeVersion?: string;
}

/** AI 에러 설명 요청 */
export interface AIExplainErrorRequest {
  errorMessage: string;
  errorType: 'build' | 'runtime' | 'lint';
  filePath?: string;
  content?: string;
  currentNodeVersion?: string;
  targetNodeVersion?: string;
}

/** AI 개선 제안 요청 */
export interface AISuggestImprovementsRequest {
  filePath: string;
  content: string;
  currentNodeVersion?: string;
  targetNodeVersion?: string;
}

/** AI 응답 — 스트리밍 청크 */
export interface AIStreamChunk {
  type: 'text' | 'code' | 'thinking';
  content: string;
}

/** AI 응답 — 완료 */
export interface AIResponseComplete {
  /** 생성된 전체 텍스트 */
  fullText: string;
  /** 수정된 코드 (있는 경우) */
  modifiedCode?: string;
  /** 토큰 사용량 */
  usage: AITokenUsage;
}

/** 토큰 사용량 */
export interface AITokenUsage {
  inputTokens: number;
  outputTokens: number;
  /** 예상 비용 (USD) */
  estimatedCostUSD: number;
}

/** 토큰 예상치 (호출 전 표시용) */
export interface AITokenEstimate {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUSD: number;
  /** 경고 메시지 (비용이 높을 때) */
  warning?: string;
}

/** AI 대화 메시지 */
export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  /** 코드 블록 (수정 제안 포함) */
  codeBlock?: {
    language: string;
    code: string;
    filePath?: string;
  };
  /** 토큰 사용량 (assistant 메시지에만) */
  usage?: AITokenUsage;
}

/** AI 세션 상태 */
export interface AISessionState {
  messages: AIChatMessage[];
  isStreaming: boolean;
  currentStreamText: string;
  /** 누적 토큰 사용량 */
  totalUsage: AITokenUsage;
  error: string | null;
}

/** AI 모델 비용 정보 */
export interface AIModelPricing {
  model: string;
  inputPricePerMToken: number;   // USD per 1M input tokens
  outputPricePerMToken: number;  // USD per 1M output tokens
}

/** API 키 검증 결과 */
export interface APIKeyValidation {
  valid: boolean;
  message: string;
}
