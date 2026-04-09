import { create } from 'zustand';
import * as projectApi from '../api/project';

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

  openFile: (filePath: string) => Promise<void>;
  closeTab: (filePath: string) => void;
  setActiveTab: (filePath: string) => void;
  updateContent: (filePath: string, content: string) => void;
  setSuggestedContent: (filePath: string, content: string) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabPath: null,

  openFile: async (filePath: string) => {
    const existing = get().tabs.find((t) => t.filePath === filePath);
    if (existing) {
      set({ activeTabPath: filePath });
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
      }));
    } catch (err) {
      console.error('파일 열기 실패:', err);
    }
  },

  closeTab: (filePath: string) => {
    set((s) => {
      const newTabs = s.tabs.filter((t) => t.filePath !== filePath);
      let newActive = s.activeTabPath;
      if (s.activeTabPath === filePath) {
        newActive = newTabs.length > 0 ? newTabs[newTabs.length - 1].filePath : null;
      }
      return { tabs: newTabs, activeTabPath: newActive };
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
    }));
  },
}));
