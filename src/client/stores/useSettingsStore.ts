import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  apiKey: string | null;
  targetNodeVersion: string;
  theme: 'dark' | 'light';
  autoSave: boolean;

  setApiKey: (key: string) => void;
  clearApiKey: () => void;
  setTargetNodeVersion: (version: string) => void;
  toggleTheme: () => void;
  setAutoSave: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKey: null,
      targetNodeVersion: '20',
      theme: 'dark',
      autoSave: false,

      setApiKey: (key) => set({ apiKey: key }),
      clearApiKey: () => set({ apiKey: null }),
      setTargetNodeVersion: (version) => set({ targetNodeVersion: version }),
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      setAutoSave: (value) => set({ autoSave: value }),
    }),
    {
      name: 'node-migrator-settings',
      partialize: (state) => ({
        apiKey: state.apiKey,
        targetNodeVersion: state.targetNodeVersion,
        theme: state.theme,
        autoSave: state.autoSave,
      }),
    },
  ),
);
