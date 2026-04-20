import path from 'path';
import fs from 'fs/promises';
import { glob } from 'glob';
import { readFile } from './fileService.js';
import { ANALYZABLE_EXTENSIONS, DEFAULT_IGNORE_PATTERNS } from '../../shared/constants.js';
import { logger } from '../utils/logger.js';

/** Import 정보 */
export interface ImportInfo {
  /** import 하는 모듈 경로 (원본 그대로) */
  source: string;
  /** 해석된 절대 경로 (로컬 파일인 경우) */
  resolvedPath?: string;
  /** 외부 패키지 여부 */
  isExternal: boolean;
  /** 패키지 이름 (외부인 경우) */
  packageName?: string;
  /** import 라인 번호 */
  line: number;
  /** import 유형 */
  type: 'esm-static' | 'esm-dynamic' | 'cjs-require';
}

/** 파일별 Import 분석 결과 */
export interface FileImports {
  filePath: string;
  imports: ImportInfo[];
}

/** Import 그래프 */
export interface ImportGraph {
  /** 파일별 import 목록 */
  files: FileImports[];
  /** 외부 패키지별 사용 파일 목록 */
  packageUsage: Record<string, { files: string[]; importCount: number }>;
  /** 로컬 파일별 "이 파일을 import하는 파일" 목록 (역참조) */
  reverseImports: Record<string, string[]>;
  /** 그래프 노드 (React Flow용) */
  nodes: { id: string; label: string; issueCount?: number; type: 'file' | 'package' }[];
  /** 그래프 엣지 (React Flow용) */
  edges: { source: string; target: string }[];
}

/** glob 패턴용 확장자 목록 생성 */
function buildGlobPattern(): string {
  const exts = ANALYZABLE_EXTENSIONS.map((e) => e.slice(1)); // 앞의 '.' 제거
  return `**/*.{${exts.join(',')}}`;
}

/** glob 무시 패턴 생성 */
function buildIgnorePatterns(): string[] {
  return DEFAULT_IGNORE_PATTERNS.map((p) => {
    // 이미 glob 패턴이면 그대로, 아니면 디렉토리 패턴으로 변환
    if (p.includes('*')) return p;
    return `${p}/**`;
  });
}

/**
 * 파일 내용에서 import/require 구문을 정규식으로 추출한다.
 * AST보다 빠르며, 대부분의 실용적 패턴을 커버한다.
 */
function extractImports(content: string): Omit<ImportInfo, 'resolvedPath' | 'isExternal' | 'packageName'>[] {
  const results: Omit<ImportInfo, 'resolvedPath' | 'isExternal' | 'packageName'>[] = [];

  // 라인 번호 계산을 위한 유틸리티
  const lines = content.split('\n');
  const getLineNumber = (index: number): number => {
    let count = 1;
    for (let i = 0; i < index && i < content.length; i++) {
      if (content[i] === '\n') count++;
    }
    return count;
  };

  // ESM 정적 import: import X from 'Y' / import { X } from 'Y' / import 'Y'
  const esmStaticRe = /import\s+(?:(?:\{[^}]*\}|[\w*]+(?:\s*,\s*\{[^}]*\})?)\s+from\s+)?['"]([^'"]+)['"]/gm;
  let match: RegExpExecArray | null;
  while ((match = esmStaticRe.exec(content)) !== null) {
    results.push({
      source: match[1],
      line: getLineNumber(match.index),
      type: 'esm-static',
    });
  }

  // ESM 동적 import: import('Y')
  const esmDynamicRe = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/gm;
  while ((match = esmDynamicRe.exec(content)) !== null) {
    results.push({
      source: match[1],
      line: getLineNumber(match.index),
      type: 'esm-dynamic',
    });
  }

  // CJS require (변수 할당 포함): const X = require('Y')
  const cjsAssignRe = /(?:const|let|var)\s+(?:\{[^}]*\}|[\w]+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/gm;
  while ((match = cjsAssignRe.exec(content)) !== null) {
    results.push({
      source: match[1],
      line: getLineNumber(match.index),
      type: 'cjs-require',
    });
  }

  // 단독 require: require('Y') — 위에서 이미 캡처되지 않은 것만
  const standaloneRequireRe = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/gm;
  const existingSources = new Set(
    results
      .filter((r) => r.type === 'cjs-require')
      .map((r) => `${r.source}:${r.line}`),
  );
  while ((match = standaloneRequireRe.exec(content)) !== null) {
    const line = getLineNumber(match.index);
    const key = `${match[1]}:${line}`;
    if (!existingSources.has(key)) {
      results.push({
        source: match[1],
        line,
        type: 'cjs-require',
      });
    }
  }

  return results;
}

/**
 * 외부 패키지 이름을 추출한다.
 * - 스코프드 패키지: @scope/name → @scope/name
 * - 일반 패키지: name/sub/path → name
 * - Node.js 내장: node:fs → node:fs (그대로)
 */
function extractPackageName(source: string): string {
  if (source.startsWith('node:')) return source;
  if (source.startsWith('@')) {
    // @scope/name 또는 @scope/name/sub/path → @scope/name
    const parts = source.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : source;
  }
  // name 또는 name/sub/path → name
  return source.split('/')[0];
}

/** 로컬 파일인지 판별 (상대경로로 시작하면 로컬) */
function isLocalImport(source: string): boolean {
  return source.startsWith('.') || source.startsWith('/');
}

/** 로컬 import 경로를 실제 파일 경로로 해석한다 */
async function resolveLocalPath(
  projectRoot: string,
  importerRelPath: string,
  source: string,
): Promise<string | undefined> {
  const importerDir = path.dirname(path.join(projectRoot, importerRelPath));
  const basePath = path.resolve(importerDir, source);

  // 시도할 확장자 목록
  const candidates = [
    basePath,
    ...ANALYZABLE_EXTENSIONS.map((ext) => basePath + ext),
    ...['index.ts', 'index.tsx', 'index.js', 'index.jsx'].map((idx) =>
      path.join(basePath, idx),
    ),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      // projectRoot 기준 상대 경로로 반환
      return path.relative(projectRoot, candidate).replace(/\\/g, '/');
    } catch {
      // 존재하지 않으면 다음 후보로
    }
  }

  return undefined;
}

/** 프로젝트 전체 import 관계 분석 */
export async function analyzeImports(projectRoot: string): Promise<ImportGraph> {
  logger.info(`Import 관계 분석 시작: ${projectRoot}`);
  const start = Date.now();

  // 1. 분석 대상 파일 목록 수집
  const pattern = buildGlobPattern();
  const ignorePatterns = buildIgnorePatterns();
  const filePaths = await glob(pattern, {
    cwd: projectRoot,
    ignore: ignorePatterns,
  });
  logger.info(`분석 대상 파일 ${filePaths.length}개 수집 완료`);

  // 2. 각 파일에서 import/require 구문 추출
  const files: FileImports[] = [];
  const packageUsage: Record<string, { files: string[]; importCount: number }> = {};
  const reverseImports: Record<string, string[]> = {};

  for (const filePath of filePaths) {
    try {
      const { content } = await readFile(projectRoot, filePath);
      const rawImports = extractImports(content);

      // 3. 각 import의 로컬/외부 구분 및 경로 해석
      const imports: ImportInfo[] = [];
      for (const raw of rawImports) {
        const isLocal = isLocalImport(raw.source);

        if (isLocal) {
          // 로컬 파일 import
          const resolvedPath = await resolveLocalPath(projectRoot, filePath, raw.source);
          imports.push({
            ...raw,
            resolvedPath,
            isExternal: false,
          });

          // 역참조 맵 구축
          if (resolvedPath) {
            if (!reverseImports[resolvedPath]) {
              reverseImports[resolvedPath] = [];
            }
            if (!reverseImports[resolvedPath].includes(filePath)) {
              reverseImports[resolvedPath].push(filePath);
            }
          }
        } else {
          // 외부 패키지 import
          const packageName = extractPackageName(raw.source);
          imports.push({
            ...raw,
            isExternal: true,
            packageName,
          });

          // 패키지 사용 현황 집계
          if (!packageUsage[packageName]) {
            packageUsage[packageName] = { files: [], importCount: 0 };
          }
          packageUsage[packageName].importCount++;
          if (!packageUsage[packageName].files.includes(filePath)) {
            packageUsage[packageName].files.push(filePath);
          }
        }
      }

      files.push({ filePath, imports });
    } catch (err) {
      logger.warn(`파일 import 분석 스킵: ${filePath} — ${(err as Error).message}`);
    }
  }

  // 4. React Flow용 노드/엣지 생성 (로컬 파일만)
  const nodeSet = new Set<string>();
  const edges: { source: string; target: string }[] = [];

  for (const file of files) {
    nodeSet.add(file.filePath);
    for (const imp of file.imports) {
      if (!imp.isExternal && imp.resolvedPath) {
        nodeSet.add(imp.resolvedPath);
        edges.push({
          source: file.filePath,
          target: imp.resolvedPath,
        });
      }
    }
  }

  const nodes = Array.from(nodeSet).map((id) => ({
    id,
    label: path.basename(id),
    issueCount: 0,  // 기본값; 라우트에서 분석 결과로 채워짐
    type: 'file' as const,
  }));

  const duration = Date.now() - start;
  logger.info(
    `Import 분석 완료: 파일 ${files.length}개, 패키지 ${Object.keys(packageUsage).length}개, ` +
    `노드 ${nodes.length}개, 엣지 ${edges.length}개 (${duration}ms)`,
  );

  return {
    files,
    packageUsage,
    reverseImports,
    nodes,
    edges,
  };
}
