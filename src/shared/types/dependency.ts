import type { RiskLevel } from '../constants.js';

/** 단일 의존성 정보 */
export interface DepInfo {
  name: string;
  currentVersion: string;
  latestVersion: string | null;
  /** npm registry engines.node 필드 */
  enginesNode: string | null;
  riskLevel: RiskLevel;
  riskReason: string;
  /** CVE 건수 */
  cveCount: number;
  /** 권장 조치 */
  recommendation: string;
  /** dev dependency 여부 */
  isDev: boolean;
  /** peer dependency 여부 */
  isPeer?: boolean;
  /** native addon (C++ 빌드) 포함 여부 */
  hasNativeAddon?: boolean;
  /** postinstall 스크립트 존재 여부 */
  hasPostInstall?: boolean;
}

/** npm audit 취약점 정보 */
export interface AuditVulnerability {
  name: string;
  severity: 'info' | 'low' | 'moderate' | 'high' | 'critical';
  title: string;
  url: string;
  range: string;
  fixAvailable: boolean;
}

/** npm audit 결과 요약 */
export interface AuditResult {
  vulnerabilities: AuditVulnerability[];
  summary: {
    info: number;
    low: number;
    moderate: number;
    high: number;
    critical: number;
    total: number;
  };
}

/** 의존성 분석 전체 결과 */
export interface DependencyAnalysisResult {
  dependencies: DepInfo[];
  audit: AuditResult | null;
  summary: {
    total: number;
    danger: number;
    warning: number;
    review: number;
    safe: number;
  };
}

/** 정렬 기준 */
export type DepSortField = 'name' | 'riskLevel' | 'cveCount' | 'currentVersion';
export type SortDirection = 'asc' | 'desc';

/** 필터 기준 */
export type DepFilterLevel = RiskLevel | 'all';

/** Import 정보 */
export interface ImportInfo {
  source: string;
  resolvedPath?: string;
  isExternal: boolean;
  packageName?: string;
  line: number;
  type: 'esm-static' | 'esm-dynamic' | 'cjs-require';
}

/** 파일별 Import 분석 */
export interface FileImportInfo {
  filePath: string;
  imports: ImportInfo[];
}

/** 패키지 사용처 정보 */
export interface PackageUsageInfo {
  files: string[];
  importCount: number;
}

/** Import 그래프 */
export interface ImportGraph {
  files: FileImportInfo[];
  packageUsage: Record<string, PackageUsageInfo>;
  reverseImports: Record<string, string[]>;
  nodes: ImportGraphNode[];
  edges: ImportGraphEdge[];
}

/** 그래프 노드 */
export interface ImportGraphNode {
  id: string;
  label: string;
  issueCount?: number;
  type: 'file' | 'package';
}

/** 그래프 엣지 */
export interface ImportGraphEdge {
  source: string;
  target: string;
}
