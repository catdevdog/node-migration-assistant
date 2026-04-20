import { create } from 'zustand';

/** 2페이지 구조: setup(준비) / work(작업) */
export type ActivePage = 'setup' | 'work';
export type DependencyTabId = 'packages' | 'scan' | 'usage' | 'graph';

interface UIState {
  sidebarOpen: boolean;
  activePage: ActivePage;
  /** 의존성 페이지 활성 탭 — 단축키로 외부에서 변경 가능 */
  dependencyTab: DependencyTabId;
  modals: {
    apiKey: boolean;
    welcome: boolean;
    confirm: boolean;
  };

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setActivePage: (page: ActivePage) => void;
  setDependencyTab: (tab: DependencyTabId) => void;
  openModal: (name: keyof UIState['modals']) => void;
  closeModal: (name: keyof UIState['modals']) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  activePage: 'setup',
  dependencyTab: 'packages',
  modals: {
    apiKey: false,
    welcome: false,
    confirm: false,
  },

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setActivePage: (page) => set({ activePage: page }),
  setDependencyTab: (tab) => set({ dependencyTab: tab }),

  openModal: (name) =>
    set((s) => ({ modals: { ...s.modals, [name]: true } })),

  closeModal: (name) =>
    set((s) => ({ modals: { ...s.modals, [name]: false } })),
}));
