/** 파일 트리 노드 */
export interface TreeNode {
  name: string;
  /** 프로젝트 루트 기준 상대 경로 */
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
  extension?: string;
  size?: number;
}

/** 감지된 프레임워크 */
export type DetectedFramework =
  | 'react'
  | 'vue'
  | 'nuxt'
  | 'nextjs'
  | 'angular'
  | 'vanilla';

/** Git 상태 (사전 분석에서 경고 배너용) */
export interface ProjectGitStatus {
  isRepo: boolean;
  currentBranch: string | null;
  /** 커밋되지 않은 변경사항 존재 여부 */
  hasUncommittedChanges: boolean;
}

/** 프로젝트 메타데이터 */
export interface ProjectInfo {
  projectPath: string;
  projectName: string;
  /** package.json engines / .nvmrc / .node-version 에서 감지 */
  currentNodeVersion: string | null;
  targetNodeVersion: string;
  detectedFramework: DetectedFramework;
  packageJson: Record<string, unknown> | null;
  hasLockFile: 'npm' | 'yarn' | 'pnpm' | null;
  hasTsConfig: boolean;
  hasEslintConfig: boolean;
  /** Git 상태 (없으면 isRepo=false) */
  gitStatus: ProjectGitStatus;
}

/** 파일 읽기 응답 */
export interface FileContent {
  content: string;
  language: string;
  size: number;
  path: string;
}
