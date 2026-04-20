import { create } from 'zustand';

/** 큐 항목 위험도 (사전분석 단계의 의존성/이슈 위험도와 매칭) */
export type QueueRisk = 'high' | 'medium' | 'low';

/** 큐 항목 상태 */
export type QueueStatus = 'pending' | 'processing' | 'completed' | 'skipped' | 'deferred';

/** 큐 항목 출처 — 사전 분석 / cascade / 수동 추가 */
export type QueueSource = 'preflight' | 'cascade' | 'manual';

export interface QueueItem {
  filePath: string;
  riskLevel: QueueRisk;
  source: QueueSource;
  status: QueueStatus;
  /** 표시용 부가 정보 (이슈 건수 등) */
  issueCount?: number;
}

interface QueueState {
  items: QueueItem[];
  /** 현재 처리 중인 항목 인덱스 (-1 = 없음) */
  activeIndex: number;

  /** 항목 일괄 추가 — filePath 기준 중복 제거, 위험도 우선 정렬 */
  addItems: (newItems: QueueItem[]) => void;
  /** 단일 항목 추가 — 이미 존재하면 위험도/카운트만 갱신 */
  addItem: (item: QueueItem) => void;
  /** 다음 pending 항목으로 이동 */
  next: () => void;
  /** 이전 항목으로 이동 */
  prev: () => void;
  /** 특정 인덱스로 이동 */
  jumpTo: (index: number) => void;
  /** 현재 항목을 완료 처리 */
  completeCurrent: () => void;
  /** 특정 파일을 완료 처리 */
  complete: (filePath: string) => void;
  /** 특정 파일을 스킵 */
  skip: (filePath: string) => void;
  /** 특정 파일을 보류 */
  defer: (filePath: string) => void;
  /** 항목 순서 변경 (드래그) */
  reorder: (from: number, to: number) => void;
  /** 큐 전체 초기화 (프로젝트 변경 시) */
  reset: () => void;
}

/** 위험도 정렬 우선순위 */
const RISK_ORDER: Record<QueueRisk, number> = { high: 0, medium: 1, low: 2 };

/** 위험도 + 상태 기준 정렬 — pending이 먼저, 그 안에서 위험도순 */
function sortItems(items: QueueItem[]): QueueItem[] {
  return [...items].sort((a, b) => {
    // pending > processing > deferred > completed/skipped
    const statusPriority: Record<QueueStatus, number> = {
      processing: 0,
      pending: 1,
      deferred: 2,
      completed: 3,
      skipped: 4,
    };
    const sa = statusPriority[a.status] - statusPriority[b.status];
    if (sa !== 0) return sa;
    return RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel];
  });
}

export const useQueueStore = create<QueueState>((set, get) => ({
  items: [],
  activeIndex: -1,

  addItems: (newItems) => {
    set((s) => {
      const map = new Map<string, QueueItem>();
      // 기존 항목 유지
      for (const it of s.items) map.set(it.filePath, it);
      // 새 항목 병합 — 이미 존재하면 위험도/이슈수만 갱신
      for (const it of newItems) {
        const existing = map.get(it.filePath);
        if (existing) {
          map.set(it.filePath, {
            ...existing,
            riskLevel:
              RISK_ORDER[it.riskLevel] < RISK_ORDER[existing.riskLevel]
                ? it.riskLevel
                : existing.riskLevel,
            issueCount: it.issueCount ?? existing.issueCount,
          });
        } else {
          map.set(it.filePath, it);
        }
      }
      const sorted = sortItems(Array.from(map.values()));
      // 첫 pending 항목으로 activeIndex 갱신 (이미 활성된 항목이 있으면 유지)
      let nextActive = s.activeIndex;
      if (nextActive < 0 || nextActive >= sorted.length) {
        nextActive = sorted.findIndex((i) => i.status === 'pending');
      }
      return { items: sorted, activeIndex: nextActive };
    });
  },

  addItem: (item) => get().addItems([item]),

  next: () => {
    set((s) => {
      const start = s.activeIndex + 1;
      for (let i = start; i < s.items.length; i++) {
        if (s.items[i].status === 'pending') return { activeIndex: i };
      }
      // 끝까지 못 찾으면 처음부터 다시
      for (let i = 0; i < start; i++) {
        if (s.items[i].status === 'pending') return { activeIndex: i };
      }
      return { activeIndex: s.activeIndex };
    });
  },

  prev: () => {
    set((s) => {
      const start = s.activeIndex - 1;
      for (let i = start; i >= 0; i--) {
        if (s.items[i].status !== 'completed' && s.items[i].status !== 'skipped') {
          return { activeIndex: i };
        }
      }
      return { activeIndex: s.activeIndex };
    });
  },

  jumpTo: (index) => {
    set((s) => {
      if (index < 0 || index >= s.items.length) return s;
      return { activeIndex: index };
    });
  },

  completeCurrent: () => {
    const { activeIndex, items } = get();
    if (activeIndex < 0 || activeIndex >= items.length) return;
    const target = items[activeIndex];
    get().complete(target.filePath);
    get().next();
  },

  complete: (filePath) => {
    set((s) => ({
      items: s.items.map((it) =>
        it.filePath === filePath ? { ...it, status: 'completed' as const } : it,
      ),
    }));
  },

  skip: (filePath) => {
    set((s) => ({
      items: s.items.map((it) =>
        it.filePath === filePath ? { ...it, status: 'skipped' as const } : it,
      ),
    }));
  },

  defer: (filePath) => {
    set((s) => ({
      items: s.items.map((it) =>
        it.filePath === filePath ? { ...it, status: 'deferred' as const } : it,
      ),
    }));
  },

  reorder: (from, to) => {
    set((s) => {
      if (from < 0 || from >= s.items.length || to < 0 || to >= s.items.length) return s;
      const next = [...s.items];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      // 활성 인덱스 보정
      let activeIndex = s.activeIndex;
      if (s.activeIndex === from) activeIndex = to;
      else if (s.activeIndex > from && s.activeIndex <= to) activeIndex--;
      else if (s.activeIndex < from && s.activeIndex >= to) activeIndex++;
      return { items: next, activeIndex };
    });
  },

  reset: () => set({ items: [], activeIndex: -1 }),
}));
