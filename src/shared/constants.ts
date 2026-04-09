/** 지원하는 Node.js LTS 버전 목록 */
export const SUPPORTED_NODE_VERSIONS = ['16', '18', '20', '22'] as const;

export type SupportedNodeVersion = (typeof SUPPORTED_NODE_VERSIONS)[number];

/** Node 버전별 주요 정보 */
export const NODE_VERSION_INFO: Record<
  SupportedNodeVersion,
  {
    codename: string;
    v8Version: string;
    ltsStart: string;
    eol: string;
    features: string[];
  }
> = {
  '16': {
    codename: 'Gallium',
    v8Version: '9.4',
    ltsStart: '2021-10-26',
    eol: '2023-09-11',
    features: [
      'Apple Silicon 네이티브 지원',
      'npm 8',
      'Corepack',
      'AbortController 안정화',
    ],
  },
  '18': {
    codename: 'Hydrogen',
    v8Version: '10.2',
    ltsStart: '2022-10-25',
    eol: '2025-04-30',
    features: [
      'fetch API 내장',
      'Test runner 모듈',
      'Watch 모드',
      'import.meta.resolve',
      'V8 Snapshot blob 지원',
    ],
  },
  '20': {
    codename: 'Iron',
    v8Version: '11.3',
    ltsStart: '2023-10-24',
    eol: '2026-04-30',
    features: [
      '안정화된 Test runner',
      'import.meta.dirname/filename',
      '.env 파일 내장 지원',
      'Permission 모델 실험적',
      'ESM 기본 로딩 개선',
    ],
  },
  '22': {
    codename: 'Jod',
    v8Version: '12.4',
    ltsStart: '2024-10-29',
    eol: '2027-04-30',
    features: [
      'require(esm) 지원',
      'WebSocket 클라이언트',
      'glob/globSync 내장',
      'V8 Maglev 컴파일러',
      'node --run 명령어',
    ],
  },
};

/** 위험 등급 */
export const RISK_LEVELS = {
  DANGER: 'danger',
  WARNING: 'warning',
  REVIEW: 'review',
  SAFE: 'safe',
} as const;

export type RiskLevel = (typeof RISK_LEVELS)[keyof typeof RISK_LEVELS];

/** 위험 등급 라벨 (한국어) */
export const RISK_LABELS: Record<RiskLevel, string> = {
  danger: '🔴 위험',
  warning: '🟠 경고',
  review: '🟡 검토',
  safe: '🟢 정상',
};

/** 스캔 시 무시할 패턴 */
export const DEFAULT_IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.output',
  'coverage',
  '.cache',
  '.turbo',
  '.vercel',
  '*.min.js',
  '*.bundle.js',
];

/** 분석 대상 파일 확장자 */
export const ANALYZABLE_EXTENSIONS = [
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
];

/** 기본 서버 포트 */
export const DEFAULT_PORT = 3847;

/** AI 모델 설정 */
export const AI_CONFIG = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
} as const;
