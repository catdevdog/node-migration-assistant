import fs from 'fs/promises';
import path from 'path';
import type { ProjectInfo, TreeNode, DetectedFramework, ProjectGitStatus } from '../../shared/types/project.js';
import { DEFAULT_IGNORE_PATTERNS } from '../../shared/constants.js';
import { logger } from '../utils/logger.js';
import { getGitStatus } from './gitService.js';

/** package.json에서 프레임워크 감지 */
function detectFramework(pkg: Record<string, unknown>): DetectedFramework {
  const deps = {
    ...(pkg.dependencies as Record<string, string> | undefined),
    ...(pkg.devDependencies as Record<string, string> | undefined),
  };

  if ('nuxt' in deps) return 'nuxt';
  if ('next' in deps) return 'nextjs';
  if ('@angular/core' in deps) return 'angular';
  if ('vue' in deps) return 'vue';
  if ('react' in deps) return 'react';
  return 'vanilla';
}

/** .nvmrc, .node-version, package.json engines/volta, .tool-versions 에서 Node 버전 감지 */
async function detectNodeVersion(projectPath: string, pkg: Record<string, unknown> | null): Promise<string | null> {
  // 1순위: .nvmrc
  try {
    const raw = await fs.readFile(path.join(projectPath, '.nvmrc'), 'utf-8');
    const version = raw.trim().replace(/^v/i, '');
    if (version && /^\d/.test(version)) return version;
  } catch { /* 없으면 다음 시도 */ }

  // 2순위: .node-version (fnm, nodenv)
  try {
    const raw = await fs.readFile(path.join(projectPath, '.node-version'), 'utf-8');
    const version = raw.trim().replace(/^v/i, '');
    if (version && /^\d/.test(version)) return version;
  } catch { /* 없으면 다음 시도 */ }

  // 3순위: .tool-versions (asdf)
  try {
    const raw = await fs.readFile(path.join(projectPath, '.tool-versions'), 'utf-8');
    const match = raw.match(/^nodejs\s+([\d.]+)/m);
    if (match) return match[1];
  } catch { /* 없으면 다음 시도 */ }

  // 4순위: package.json volta.node
  if (pkg?.volta && typeof pkg.volta === 'object') {
    const volta = pkg.volta as Record<string, string>;
    if (volta.node) {
      const version = volta.node.replace(/^v/i, '');
      if (version && /^\d/.test(version)) return version;
    }
  }

  // 5순위: package.json engines.node (범위 표현식에서 최솟값 추출)
  if (pkg?.engines && typeof pkg.engines === 'object') {
    const engines = pkg.engines as Record<string, string>;
    if (engines.node) {
      // >=12.0.0, ^14, ~16.0.0, 18.x 등에서 첫 번째 숫자 추출
      const match = engines.node.match(/(\d+)(?:\.\d+)*/);
      if (match) return match[1];
    }
  }

  // 6순위: package-lock.json lockfileVersion으로 npm/Node 버전 추정
  try {
    const raw = await fs.readFile(path.join(projectPath, 'package-lock.json'), 'utf-8');
    const lock = JSON.parse(raw) as { lockfileVersion?: number; node?: string };
    // lockfileVersion 1 = npm 5-6 (Node 8-10), 2 = npm 7+ (Node 15+), 3 = npm 7+ strict
    // lock 파일에 node 필드가 있는 경우 (npm 7+)
    if (lock.node) {
      const version = lock.node.replace(/^v/i, '');
      if (version && /^\d/.test(version)) return version;
    }
  } catch { /* 없으면 다음 시도 */ }

  // 감지 실패 — null 반환 (현재 설치된 Node 버전으로 오도하지 않음)
  return null;
}

/** Lock 파일 감지 */
async function detectLockFile(projectPath: string): Promise<'npm' | 'yarn' | 'pnpm' | null> {
  const checks: Array<{ file: string; type: 'npm' | 'yarn' | 'pnpm' }> = [
    { file: 'package-lock.json', type: 'npm' },
    { file: 'yarn.lock', type: 'yarn' },
    { file: 'pnpm-lock.yaml', type: 'pnpm' },
  ];

  for (const { file, type } of checks) {
    try {
      await fs.access(path.join(projectPath, file));
      return type;
    } catch { /* 다음 시도 */ }
  }
  return null;
}

/** 파일 확장자 → 언어 매핑 */
function getLanguage(ext: string): string {
  const map: Record<string, string> = {
    '.ts': 'typescript', '.tsx': 'typescriptreact',
    '.js': 'javascript', '.jsx': 'javascriptreact',
    '.json': 'json', '.md': 'markdown',
    '.css': 'css', '.scss': 'scss', '.less': 'less',
    '.html': 'html', '.vue': 'vue',
    '.yaml': 'yaml', '.yml': 'yaml',
  };
  return map[ext] ?? 'plaintext';
}

/** 디렉토리를 재귀 스캔하여 파일 트리 생성 (깊이 제한) */
async function buildTree(
  dirPath: string,
  projectRoot: string,
  maxDepth: number,
  currentDepth = 0,
): Promise<TreeNode[]> {
  if (currentDepth >= maxDepth) return [];

  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  // 이름순 정렬 (디렉토리 우선)
  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  const nodes: TreeNode[] = [];

  for (const entry of entries) {
    // 무시 패턴 체크
    if (DEFAULT_IGNORE_PATTERNS.some((p) => entry.name === p || entry.name.match(p.replace('*', '.*')))) {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(projectRoot, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      const children = await buildTree(fullPath, projectRoot, maxDepth, currentDepth + 1);
      nodes.push({
        name: entry.name,
        path: relativePath,
        type: 'directory',
        children,
      });
    } else {
      const ext = path.extname(entry.name);
      let size = 0;
      try {
        const stat = await fs.stat(fullPath);
        size = stat.size;
      } catch { /* 무시 */ }

      nodes.push({
        name: entry.name,
        path: relativePath,
        type: 'file',
        extension: ext,
        size,
      });
    }
  }

  return nodes;
}

/** 프로젝트 로드 — 메인 진입점 */
export async function loadProject(projectPath: string): Promise<{
  projectInfo: ProjectInfo;
  fileTree: TreeNode[];
}> {
  const absolutePath = path.resolve(projectPath);
  logger.info(`프로젝트 로드 중: ${absolutePath}`);

  // package.json 읽기
  let pkg: Record<string, unknown> | null = null;
  try {
    const raw = await fs.readFile(path.join(absolutePath, 'package.json'), 'utf-8');
    pkg = JSON.parse(raw);
  } catch {
    logger.warn('package.json을 찾을 수 없습니다.');
  }

  // tsconfig.json 존재 여부
  let hasTsConfig = false;
  try {
    await fs.access(path.join(absolutePath, 'tsconfig.json'));
    hasTsConfig = true;
  } catch { /* 없음 */ }

  // ESLint 설정 존재 여부
  let hasEslintConfig = false;
  const eslintFiles = ['.eslintrc', '.eslintrc.js', '.eslintrc.json', '.eslintrc.yml', 'eslint.config.js', 'eslint.config.mjs'];
  for (const f of eslintFiles) {
    try {
      await fs.access(path.join(absolutePath, f));
      hasEslintConfig = true;
      break;
    } catch { /* 다음 시도 */ }
  }

  const [nodeVersion, lockFile, fileTree, rawGitStatus] = await Promise.all([
    detectNodeVersion(absolutePath, pkg),
    detectLockFile(absolutePath),
    buildTree(absolutePath, absolutePath, 5),
    getGitStatus(absolutePath).catch(() => null),
  ]);

  const gitStatus: ProjectGitStatus = rawGitStatus
    ? {
        isRepo: rawGitStatus.isRepo,
        currentBranch: rawGitStatus.currentBranch,
        hasUncommittedChanges: rawGitStatus.hasUncommittedChanges,
      }
    : { isRepo: false, currentBranch: null, hasUncommittedChanges: false };

  const projectInfo: ProjectInfo = {
    projectPath: absolutePath,
    projectName: (pkg?.name as string) ?? path.basename(absolutePath),
    currentNodeVersion: nodeVersion,
    targetNodeVersion: '20',
    detectedFramework: pkg ? detectFramework(pkg) : 'vanilla',
    packageJson: pkg,
    hasLockFile: lockFile,
    hasTsConfig,
    hasEslintConfig,
    gitStatus,
  };

  logger.info(`프로젝트: ${projectInfo.projectName}`);
  logger.info(`Node 버전: ${projectInfo.currentNodeVersion ?? '알 수 없음'} → ${projectInfo.targetNodeVersion}`);
  logger.info(`프레임워크: ${projectInfo.detectedFramework}`);
  logger.info(`파일 수: ${countFiles(fileTree)}개`);

  return { projectInfo, fileTree };
}

/** 하위 디렉토리의 자식 노드만 로드 (lazy loading) */
export async function loadSubTree(projectPath: string, relativeDirPath: string): Promise<TreeNode[]> {
  const absolutePath = path.resolve(projectPath);
  const targetDir = path.join(absolutePath, relativeDirPath);
  return buildTree(targetDir, absolutePath, 3);
}

function countFiles(nodes: TreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === 'file') count++;
    if (node.children) count += countFiles(node.children);
  }
  return count;
}

export { getLanguage };
