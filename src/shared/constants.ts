/** 마이그레이션 타겟으로 선택 가능한 Node.js LTS 버전 (현재 활성 LTS만) */
export const TARGET_NODE_VERSIONS = ['20', '22', '24'] as const;

/** 소스(감지 대상)로 인식하는 Node.js 버전 (EOL 포함) */
export const ALL_NODE_VERSIONS = ['12', '14', '16', '18', '20', '22', '24'] as const;

/** 하위 호환: 기존 코드에서 사용하는 별칭 */
export const SUPPORTED_NODE_VERSIONS = TARGET_NODE_VERSIONS;

export type TargetNodeVersion = (typeof TARGET_NODE_VERSIONS)[number];
export type SupportedNodeVersion = TargetNodeVersion;

/** Node 버전별 주요 정보 */
export interface NodeVersionInfo {
  codename: string;
  v8Version: string;
  ltsStart: string;
  eol: string;
  isEOL: boolean;
  features: string[];
}

export const NODE_VERSION_INFO: Record<string, NodeVersionInfo> = {
  '12': {
    codename: 'Erbium',
    v8Version: '7.8',
    ltsStart: '2019-10-21',
    eol: '2022-04-30',
    isEOL: true,
    features: [
      'ES2019 완전 지원',
      'Worker Threads 안정화',
      'Diagnostic Reports',
    ],
  },
  '14': {
    codename: 'Fermium',
    v8Version: '8.4',
    ltsStart: '2020-10-27',
    eol: '2023-04-30',
    isEOL: true,
    features: [
      'Optional Chaining/Nullish Coalescing',
      'Diagnostic Channel',
      'Top-level Await 실험적',
    ],
  },
  '16': {
    codename: 'Gallium',
    v8Version: '9.4',
    ltsStart: '2021-10-26',
    eol: '2023-09-11',
    isEOL: true,
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
    isEOL: true,
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
    isEOL: false,
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
    isEOL: false,
    features: [
      'require(esm) 지원',
      'WebSocket 클라이언트',
      'glob/globSync 내장',
      'V8 Maglev 컴파일러',
      'node --run 명령어',
    ],
  },
  '24': {
    codename: 'TBD',
    v8Version: '13.6',
    ltsStart: '2025-10-28',
    eol: '2028-04-30',
    isEOL: false,
    features: [
      'URLPattern API 안정화',
      'Permission 모델 안정화',
      'Web Crypto 확장',
      'net.BlockList 개선',
      'AsyncLocalStorage 성능 개선',
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
