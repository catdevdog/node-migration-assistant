import { create } from 'zustand';
import type {
  DepInfo,
  AuditResult,
  DependencyAnalysisResult,
  DepSortField,
  SortDirection,
  DepFilterLevel,
} from '@shared/types/dependency';
import type { RiskLevel } from '@shared/constants';
import * as depApi from '../api/dependency';

interface DependencyState {
  dependencies: DepInfo[];
  audit: AuditResult | null;
  summary: DependencyAnalysisResult['summary'] | null;
  isLoading: boolean;
  error: string | null;

  // 정렬/필터
  sortField: DepSortField;
  sortDirection: SortDirection;
  filterLevel: DepFilterLevel;
  searchQuery: string;

  // 액션
  analyze: (targetNodeVersion: string) => Promise<void>;
  setSort: (field: DepSortField) => void;
  setFilter: (level: DepFilterLevel) => void;
  setSearch: (query: string) => void;

  // 계산된 값
  getFilteredDeps: () => DepInfo[];
}

const RISK_ORDER: Record<RiskLevel, number> = { danger: 0, warning: 1, review: 2, safe: 3 };

export const useDependencyStore = create<DependencyState>((set, get) => ({
  dependencies: [],
  audit: null,
  summary: null,
  isLoading: false,
  error: null,
  sortField: 'riskLevel',
  sortDirection: 'asc',
  filterLevel: 'all',
  searchQuery: '',

  analyze: async (targetNodeVersion: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await depApi.analyzeDependencies(targetNodeVersion);
      set({
        dependencies: result.dependencies,
        audit: result.audit,
        summary: result.summary,
        isLoading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '의존성 분석 실패';
      set({ error: message, isLoading: false });
    }
  },

  setSort: (field: DepSortField) => {
    const state = get();
    if (state.sortField === field) {
      set({ sortDirection: state.sortDirection === 'asc' ? 'desc' : 'asc' });
    } else {
      set({ sortField: field, sortDirection: 'asc' });
    }
  },

  setFilter: (level: DepFilterLevel) => set({ filterLevel: level }),
  setSearch: (query: string) => set({ searchQuery: query }),

  getFilteredDeps: () => {
    const { dependencies, filterLevel, searchQuery, sortField, sortDirection } = get();

    let filtered = [...dependencies];

    // 필터
    if (filterLevel !== 'all') {
      filtered = filtered.filter((d) => d.riskLevel === filterLevel);
    }

    // 검색
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((d) => d.name.toLowerCase().includes(q));
    }

    // 정렬
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'riskLevel':
          cmp = RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel];
          break;
        case 'cveCount':
          cmp = b.cveCount - a.cveCount;
          break;
        case 'currentVersion':
          cmp = a.currentVersion.localeCompare(b.currentVersion);
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return filtered;
  },
}));
