import { create } from 'zustand';
import * as projectApi from '../api/project';
import { apiClient } from '../api/client';

/** 에디터 뷰 모드 */
export type EditorViewMode = 'code' | 'diff';

export interface EditorTab {
  filePath: string;
  label: string;
  /** 디스크에 저장된 코드 (읽기 전용 표시) */
  content: string;
  /** 규칙/AI가 제안한 수정안 — null이면 제안 없음 */
  suggestedContent: string | null;
  language: string;
}

interface EditorState {
  tabs: EditorTab[];
  activeTabPath: string | null;
  /** 현재 뷰 모드: code(원본 표시) 또는 diff(원본 vs 제안) */
  viewMode: EditorViewMode;
  /** 승인/저장 진행 상태 */
  saving: boolean;

  openFile: (filePath: string) => Promise<void>;
  closeTab: (filePath: string) => void;
  setActiveTab: (filePath: string) => void;
  setSuggestedContent: (filePath: string, content: string) => void;
  clearSuggestedContent: (filePath: string) => void;
  /**
   * 제안된 수정을 승인하여 디스크에 저장.
   * — Monaco는 항상 읽기 전용이므로 파일 변경의 유일한 진입점.
   * 성공 시 원본 콘텐츠가 새 코드로 갱신되고 제안은 비워집니다.
   */
  approveSuggestion: (filePath: string) => Promise<void>;
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
            content,
            suggestedContent: null,
            language,
          },
        ],
        activeTabPath: filePath,
        viewMode: 'code',
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
      return { tabs: newTabs, activeTabPath: newActive, viewMode: 'code' };
    });
  },

  setActiveTab: (filePath: string) => set({ activeTabPath: filePath }),

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

  approveSuggestion: async (filePath: string) => {
    const tab = get().tabs.find((t) => t.filePath === filePath);
    if (!tab || tab.suggestedContent === null) return;
    if (tab.suggestedContent === tab.content) {
      // 변경 사항이 없으면 제안만 비우기
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.filePath === filePath ? { ...t, suggestedContent: null } : t,
        ),
        viewMode: 'code',
      }));
      return;
    }

    set({ saving: true });
    try {
      await apiClient.post('/file/write', {
        filePath,
        content: tab.suggestedContent,
      });
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.filePath === filePath
            ? { ...t, content: t.suggestedContent ?? t.content, suggestedContent: null }
            : t,
        ),
        viewMode: 'code',
        saving: false,
      }));
    } catch (err) {
      console.error('파일 승인 실패:', err);
      set({ saving: false });
    }
  },

  setViewMode: (mode: EditorViewMode) => set({ viewMode: mode }),
}));
