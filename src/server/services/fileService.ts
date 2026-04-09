import fs from 'fs/promises';
import path from 'path';
import { resolveSafePath } from '../utils/pathResolver.js';
import { getLanguage } from './projectLoader.js';
import type { FileContent } from '../../shared/types/project.js';

/** 파일 읽기 (경로 순회 방지 포함) */
export async function readFile(projectRoot: string, relativePath: string): Promise<FileContent> {
  const safePath = resolveSafePath(projectRoot, relativePath);
  const content = await fs.readFile(safePath, 'utf-8');
  const stat = await fs.stat(safePath);
  const ext = path.extname(relativePath);

  return {
    content,
    language: getLanguage(ext),
    size: stat.size,
    path: relativePath,
  };
}

/** 파일 쓰기 (경로 순회 방지 포함) */
export async function writeFile(projectRoot: string, relativePath: string, content: string): Promise<void> {
  const safePath = resolveSafePath(projectRoot, relativePath);
  await fs.writeFile(safePath, content, 'utf-8');
}
