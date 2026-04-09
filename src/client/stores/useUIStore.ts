import { create } from 'zustand';

export type ActivePage = 'editor' | 'dependencies' | 'dashboard' | 'settings';

interface UIState {
  sidebarOpen: boolean;
  activePage: ActivePage;
  modals: {
    apiKey: boolean;
    welcome: boolean;
    confirm: boolean;
  };

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setActivePage: (page: ActivePage) => void;
  openModal: (name: keyof UIState['modals']) => void;
  closeModal: (name: keyof UIState['modals']) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  activePage: 'editor',
  modals: {
    apiKey: false,
    welcome: false,
    confirm: false,
  },

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setActivePage: (page) => set({ activePage: page }),

  openModal: (name) =>
    set((s) => ({ modals: { ...s.modals, [name]: true } })),

  closeModal: (name) =>
    set((s) => ({ modals: { ...s.modals, [name]: false } })),
}));
