import { create } from 'zustand';
import * as fileApi from '../api/file';
import type { FileAnalysisResult } from '@shared/types/analysis';
import type { RuleMatch } from '@shared/types/rule';

interface AnalysisState {
  /** 파일별 분석 결과 캐시 */
  results: Record<string, FileAnalysisResult>;
  /** 현재 분석 중인 파일 */
  analyzingFile: string | null;
  /** 에러 메시지 */
  error: string | null;

  /** 단일 파일 분석 실행 */
  analyzeFile: (filePath: string, targetNodeVersion: string, currentNodeVersion?: string) => Promise<void>;
  /** 캐시된 결과 조회 */
  getResult: (filePath: string) => FileAnalysisResult | null;
  /** 캐시 제거 */
  clearResult: (filePath: string) => void;
  /** 전체 초기화 */
  clearAll: () => void;
}

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  results: {},
  analyzingFile: null,
  error: null,

  analyzeFile: async (filePath, targetNodeVersion, currentNodeVersion) => {
    set({ analyzingFile: filePath, error: null });
    try {
      const result = await fileApi.analyzeFile(filePath, targetNodeVersion, currentNodeVersion);
      set((s) => ({
        results: { ...s.results, [filePath]: result },
        analyzingFile: null,
      }));
    } catch (err) {
      set({
        analyzingFile: null,
        error: (err as Error).message,
      });
    }
  },

  getResult: (filePath) => get().results[filePath] ?? null,

  clearResult: (filePath) => {
    set((s) => {
      const next = { ...s.results };
      delete next[filePath];
      return { results: next };
    });
  },

  clearAll: () => set({ results: {}, analyzingFile: null, error: null }),
}));
