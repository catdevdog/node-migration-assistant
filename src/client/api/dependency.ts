import { apiClient } from './client';
import type { DependencyAnalysisResult, AuditResult } from '@shared/types/dependency';

/** 전체 의존성 분석 (npm audit 포함) */
export async function analyzeDependencies(
  targetNodeVersion: string,
): Promise<DependencyAnalysisResult> {
  return apiClient.post('/deps/analyze', { targetNodeVersion });
}

/** npm audit만 단독 실행 */
export async function runAudit(): Promise<AuditResult> {
  return apiClient.get('/deps/audit');
}
