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
    try {
      const { projectInfo, fileTree } = await projectApi.loadProject();
      set({ projectInfo, fileTree, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : '프로젝트 로드 실패';
      set({ error: message, isLoading: false });
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
