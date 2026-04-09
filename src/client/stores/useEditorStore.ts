import { create } from 'zustand';
import * as projectApi from '../api/project';
import { apiClient } from '../api/client';

/** 에디터 뷰 모드 */
export type EditorViewMode = 'code' | 'diff';

export interface EditorTab {
  filePath: string;
  label: string;
  isDirty: boolean;
  content: string;
  originalContent: string;
  suggestedContent: string | null;
  language: string;
}

interface EditorState {
  tabs: EditorTab[];
  activeTabPath: string | null;
  /** 현재 뷰 모드: code(편집) 또는 diff(원본 vs 수정) */
  viewMode: EditorViewMode;
  /** 저장 중 상태 */
  saving: boolean;

  openFile: (filePath: string) => Promise<void>;
  closeTab: (filePath: string) => void;
  setActiveTab: (filePath: string) => void;
  updateContent: (filePath: string, content: string) => void;
  setSuggestedContent: (filePath: string, content: string) => void;
  clearSuggestedContent: (filePath: string) => void;
  /** 수정 제안을 현재 코드에 적용 */
  applySuggestion: (filePath: string) => void;
  /** 파일을 서버에 저장 */
  saveFile: (filePath: string) => Promise<void>;
  /** 뷰 모드 전환 */
  setViewMode: (mode: EditorViewMode) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabPath: null,
  viewMode: 'code',
  saving: false,

  openFile: async (filePath: string) => {
    const existing = get().tabs.find((t) => t.filePath === filePath);
    if (existing) {
      set({ activeTabPath: filePath, viewMode: 'code' });
      return;
    }

    try {
      const { content, language } = await projectApi.readFile(filePath);
      const label = filePath.split('/').pop() ?? filePath;

      set((s) => ({
        tabs: [
          ...s.tabs,
          {
            filePath,
            label,
            isDirty: false,
            content,
            originalContent: content,
            suggestedContent: null,
            language,
          },
        ],
        activeTabPath: filePath,
        viewMode: 'code',
      }));
    } catch (err) {
      console.error('파일 열기 ��패:', err);
    }
  },

  closeTab: (filePath: string) => {
    set((s) => {
      const newTabs = s.tabs.filter((t) => t.filePath !== filePath);
      let newActive = s.activeTabPath;
      if (s.activeTabPath === filePath) {
        newActive = newTabs.length > 0 ? newTabs[newTabs.length - 1].filePath : null;
      }
      return { tabs: newTabs, activeTabPath: newActive, viewMode: 'code' };
    });
  },

  setActiveTab: (filePath: string) => set({ activeTabPath: filePath }),

  updateContent: (filePath: string, content: string) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.filePath === filePath
          ? { ...t, content, isDirty: t.originalContent !== content }
          : t,
      ),
    }));
  },

  setSuggestedContent: (filePath: string, content: string) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.filePath === filePath ? { ...t, suggestedContent: content } : t,
      ),
      viewMode: 'diff',
    }));
  },

  clearSuggestedContent: (filePath: string) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.filePath === filePath ? { ...t, suggestedContent: null } : t,
      ),
      viewMode: 'code',
    }));
  },

  applySuggestion: (filePath: string) => {
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.filePath !== filePath || !t.suggestedContent) return t;
        return {
          ...t,
          content: t.suggestedContent,
          suggestedContent: null,
          isDirty: t.originalContent !== t.suggestedContent,
        };
      }),
      viewMode: 'code',
    }));
  },

  saveFile: async (filePath: string) => {
    const tab = get().tabs.find((t) => t.filePath === filePath);
    if (!tab || !tab.isDirty) return;

    set({ saving: true });
    try {
      await apiClient.post('/file/write', { filePath, content: tab.content });
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.filePath === filePath
            ? { ...t, originalContent: t.content, isDirty: false }
            : t,
        ),
        saving: false,
      }));
    } catch (err) {
      console.error('파일 저장 실패:', err);
      set({ saving: false });
    }
  },

  setViewMode: (mode: EditorViewMode) => set({ viewMode: mode }),
}));
