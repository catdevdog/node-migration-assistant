import { apiClient } from './client';
import type { FileAnalysisResult } from '@shared/types/analysis';

/** 단일 파일 분석 요청 */
export async function analyzeFile(
  filePath: string,
  targetNodeVersion: string,
  currentNodeVersion?: string,
): Promise<FileAnalysisResult> {
  return apiClient.post<FileAnalysisResult>('/file/analyze', {
    filePath,
    targetNodeVersion,
    currentNodeVersion,
  });
}

/** 등록된 규칙 목록 조회 */
export async function getRules() {
  return apiClient.get<
    Array<{
      id: string;
      name: string;
      description: string;
      category: string;
      severity: string;
      fileExtensions: string[];
    }>
  >('/file/rules');
}
