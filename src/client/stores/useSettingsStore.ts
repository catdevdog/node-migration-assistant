import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  apiKey: string | null;
  targetNodeVersion: string;
  theme: 'dark' | 'light';
  autoSave: boolean;
  /** 내 작업 범위 glob 패턴 (예: "src/auth/**,src/api/**") — 빈 문자열이면 전체 */
  scopePatterns: string;
  /** 마이그레이션 가이드 메모 — AI 분석 시 컨텍스트로 전달 */
  migrationGuide: string;

  setApiKey: (key: string) => void;
  clearApiKey: () => void;
  setTargetNodeVersion: (version: string) => void;
  toggleTheme: () => void;
  setAutoSave: (value: boolean) => void;
  setScopePatterns: (patterns: string) => void;
  setMigrationGuide: (guide: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKey: null,
      targetNodeVersion: '20',
      theme: 'dark',
      autoSave: false,
      scopePatterns: '',
      migrationGuide: '',

      setApiKey: (key) => set({ apiKey: key }),
      clearApiKey: () => set({ apiKey: null }),
      setTargetNodeVersion: (version) => set({ targetNodeVersion: version }),
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      setAutoSave: (value) => set({ autoSave: value }),
      setScopePatterns: (patterns) => set({ scopePatterns: patterns }),
      setMigrationGuide: (guide) => set({ migrationGuide: guide }),
    }),
    {
      name: 'node-migrator-settings',
      partialize: (state) => ({
        apiKey: state.apiKey,
        targetNodeVersion: state.targetNodeVersion,
        theme: state.theme,
        autoSave: state.autoSave,
        scopePatterns: state.scopePatterns,
        migrationGuide: state.migrationGuide,
      }),
    },
  ),
);
