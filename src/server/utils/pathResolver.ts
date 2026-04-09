import path from 'path';
import fs from 'fs';

/**
 * 경로 순회 공격 방지 — 모든 파일 접근은 이 함수를 거쳐야 함.
 * projectRoot 밖으로 나가는 경로를 차단한다.
 */
export function resolveSafePath(
  projectRoot: string,
  relativePath: string,
): string {
  // 정규화 후 절대 경로 생성
  const resolved = path.resolve(projectRoot, relativePath);
  const normalizedRoot = path.resolve(projectRoot);

  // 프로젝트 루트 밖으로 나가는 경로 차단
  if (!resolved.startsWith(normalizedRoot + path.sep) && resolved !== normalizedRoot) {
    throw new Error(`경로 접근 거부: ${relativePath} — 프로젝트 디렉토리 밖입니다.`);
  }

  return resolved;
}

/** 파일 존재 여부 확인 */
export function fileExists(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/** 디렉토리 존재 여부 확인 */
export function dirExists(dirPath: string): boolean {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}
