import { create } from 'zustand';
import type { ProjectInfo, TreeNode } from '@shared/types/project';
import * as projectApi from '../api/project';

interface ProjectState {
  projectInfo: ProjectInfo | null;
  fileTree: TreeNode[];
  isLoading: boolean;
  error: string | null;

  loadProject: () => Promise<void>;
  refreshTree: (dirPath: string) => Promise<TreeNode[]>;
  setTargetVersion: (version: string) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projectInfo: null,
  fileTree: [],
  isLoading: false,
  error: null,

  loadProject: async () => {
    set({ isLoading: true, error: null });

    // 서버가 아직 안 떴을 수 있으므로 재시도 (최대 10회, 1.5초 간격)
    const MAX_RETRIES = 10;
    const RETRY_DELAY = 1500;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { projectInfo, fileTree } = await projectApi.loadProject();
        set({ projectInfo, fileTree, isLoading: false });
        return;
      } catch (err) {
        const isNetworkError =
          err instanceof Error &&
          (err.message.includes('fetch') || err.message.includes('Failed') || err.message.includes('ECONNREFUSED'));

        if (isNetworkError && attempt < MAX_RETRIES) {
          // 서버 연결 실패 — 잠시 후 재시도
          await new Promise((r) => setTimeout(r, RETRY_DELAY));
          continue;
        }

        const message = err instanceof Error ? err.message : '프로젝트 로드 실패';
        set({ error: message, isLoading: false });
        return;
      }
    }
  },

  refreshTree: async (dirPath: string) => {
    try {
      return await projectApi.getSubTree(dirPath);
    } catch {
      return [];
    }
  },

  setTargetVersion: (version: string) => {
    const info = get().projectInfo;
    if (info) {
      set({ projectInfo: { ...info, targetNodeVersion: version } });
    }
  },
}));
