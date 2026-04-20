import { useEffect } from 'react';
import { useEditorStore } from '../stores/useEditorStore';
import { useQueueStore } from '../stores/useQueueStore';
import { useUIStore } from '../stores/useUIStore';

/**
 * 전역 단축키 등록 — Phase 8.
 *
 * 단축키:
 *   - Ctrl/Cmd + S        현재 파일의 수정 제안을 승인 (있을 때만)
 *   - Ctrl/Cmd + ]        큐의 다음 pending 파일로 이동 + 파일 열기
 *   - Ctrl/Cmd + [        큐의 이전 항목으로 이동 + 파일 열기
 *   - Ctrl/Cmd + G        의존성 페이지의 그래프 탭으로 이동
 */
export function useShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;

      // input/textarea/contentEditable에서 입력 중이면 단축키 무시
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) {
        // Ctrl+S만 예외 — 어디서든 승인
        if (e.key !== 's' && e.key !== 'S') return;
      }

      // Ctrl+S — 승인
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        const editor = useEditorStore.getState();
        const tab = editor.tabs.find((t) => t.filePath === editor.activeTabPath);
        if (!tab || tab.suggestedContent === null) return;
        void editor.approveSuggestion(tab.filePath).then(() => {
          const queue = useQueueStore.getState();
          if (queue.items.some((it) => it.filePath === tab.filePath)) {
            queue.complete(tab.filePath);
            queue.next();
            // 다음 활성 항목으로 자동 이동 + 파일 열기
            const next = useQueueStore.getState();
            const item = next.items[next.activeIndex];
            if (item) void useEditorStore.getState().openFile(item.filePath);
          }
        });
        return;
      }

      // Ctrl+] — 다음 큐 항목
      if (e.key === ']') {
        e.preventDefault();
        const queue = useQueueStore.getState();
        if (queue.items.length === 0) return;
        queue.next();
        const next = useQueueStore.getState();
        const item = next.items[next.activeIndex];
        if (item) void useEditorStore.getState().openFile(item.filePath);
        return;
      }

      // Ctrl+[ — 이전 큐 항목
      if (e.key === '[') {
        e.preventDefault();
        const queue = useQueueStore.getState();
        if (queue.items.length === 0) return;
        queue.prev();
        const prev = useQueueStore.getState();
        const item = prev.items[prev.activeIndex];
        if (item) void useEditorStore.getState().openFile(item.filePath);
        return;
      }

      // Ctrl+G — 의존성 그래프
      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        const ui = useUIStore.getState();
        ui.setActivePage('dependencies');
        ui.setDependencyTab('graph');
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
