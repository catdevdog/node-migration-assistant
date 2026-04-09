import { apiClient } from './client';
import type { ProjectInfo, TreeNode, FileContent } from '@shared/types/project';

/** 프로젝트 로드 */
export async function loadProject(): Promise<{
  projectInfo: ProjectInfo;
  fileTree: TreeNode[];
}> {
  return apiClient.post('/project/load');
}

/** 프로젝트 정보 가져오기 */
export async function getProjectInfo(): Promise<ProjectInfo> {
  return apiClient.get('/project/info');
}

/** 하위 디렉토리 로드 (lazy loading) */
export async function getSubTree(dirPath: string): Promise<TreeNode[]> {
  return apiClient.get('/project/tree', { path: dirPath });
}

/** 파일 읽기 */
export async function readFile(filePath: string): Promise<FileContent> {
  return apiClient.get('/file/read', { path: filePath });
}
