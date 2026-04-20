import { useState } from 'react';
import {
  ListChecks,
  ChevronLeft,
  ChevronRight,
  SkipForward,
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useQueueStore, type QueueItem, type QueueRisk } from '../../stores/useQueueStore';
import { useEditorStore } from '../../stores/useEditorStore';

/** 위험도별 색상 */
const RISK_STYLES: Record<QueueRisk, { dot: string; label: string }> = {
  high: { dot: 'bg-red-500', label: '🔴' },
  medium: { dot: 'bg-orange-500', label: '🟠' },
  low: { dot: 'bg-yellow-500', label: '🟡' },
};

/** 상태별 라벨 */
const STATUS_LABEL: Record<QueueItem['status'], string> = {
  pending: '대기',
  processing: '진행',
  completed: '완료',
  skipped: '스킵',
  deferred: '보류',
};

const STATUS_COLOR: Record<QueueItem['status'], string> = {
  pending: 'text-gray-400 bg-gray-700/40',
  processing: 'text-blue-300 bg-blue-700/30',
  completed: 'text-green-300 bg-green-700/30',
  skipped: 'text-gray-500 bg-gray-700/20',
  deferred: 'text-purple-300 bg-purple-700/30',
};

/** 처리 큐 패널 — 파일트리 위에 위치 */
export function QueuePanel() {
  const items = useQueueStore((s) => s.items);
  const activeIndex = useQueueStore((s) => s.activeIndex);
  const [collapsed, setCollapsed] = useState(false);
  const [draggingFrom, setDraggingFrom] = useState<number | null>(null);

  if (items.length === 0) {
    return (
      <div className="border-b border-gray-700 px-3 py-2 text-xs text-gray-500 flex items-center gap-2">
        <ListChecks size={12} />
        <span>처리 큐 비어있음</span>
      </div>
    );
  }

  const completedCount = items.filter((i) => i.status === 'completed').length;
  const pendingCount = items.filter((i) => i.status === 'pending').length;

  const handleNext = () => useQueueStore.getState().next();
  const handlePrev = () => useQueueStore.getState().prev();

  /** 항목 클릭 → 해당 인덱스로 점프 + 파일 열기 */
  const handleClick = async (index: number, item: QueueItem) => {
    useQueueStore.getState().jumpTo(index);
    await useEditorStore.getState().openFile(item.filePath);
  };

  return (
    <div className="border-b border-gray-700 bg-gray-850 shrink-0">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700/60">
        <ListChecks size={12} className="text-blue-400 shrink-0" />
        <span className="text-xs font-medium text-gray-300">처리 큐</span>
        <span className="text-[10px] text-gray-500 ml-1">
          {completedCount}/{items.length} 완료
        </span>
        <button
          className="ml-auto text-gray-500 hover:text-gray-300"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? '큐 펼치기' : '큐 접기'}
        >
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {/* 액션 바 */}
      {!collapsed && (
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-700/60">
          <button
            onClick={handlePrev}
            className="px-1.5 py-1 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded"
            title="이전 (Ctrl+[)"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={handleNext}
            className="px-1.5 py-1 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded"
            title="다음 (Ctrl+])"
          >
            <ChevronRight size={14} />
          </button>
          <div className="ml-auto text-[10px] text-gray-500">{pendingCount}건 남음</div>
        </div>
      )}

      {/* 항목 리스트 */}
      {!collapsed && (
        <ul className="max-h-[260px] overflow-y-auto custom-scrollbar">
          {items.map((item, index) => {
            const isActive = index === activeIndex;
            const risk = RISK_STYLES[item.riskLevel];
            const fileName = item.filePath.split('/').pop() ?? item.filePath;
            const dimmed =
              item.status === 'completed' || item.status === 'skipped';

            return (
              <li
                key={item.filePath}
                draggable
                onDragStart={() => setDraggingFrom(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (draggingFrom !== null && draggingFrom !== index) {
                    useQueueStore.getState().reorder(draggingFrom, index);
                  }
                  setDraggingFrom(null);
                }}
                onClick={() => handleClick(index, item)}
                className={`
                  group flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer
                  border-l-2 transition-colors
                  ${isActive ? 'bg-blue-900/30 border-blue-500' : 'border-transparent hover:bg-gray-800/60'}
                  ${dimmed ? 'opacity-50' : ''}
                `}
                title={item.filePath}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${risk.dot}`} />
                <span className="truncate flex-1 text-gray-200">{fileName}</span>
                {typeof item.issueCount === 'number' && item.issueCount > 0 && (
                  <span className="text-[10px] text-gray-500 shrink-0">{item.issueCount}건</span>
                )}
                <span
                  className={`text-[9px] px-1 py-px rounded shrink-0 ${STATUS_COLOR[item.status]}`}
                >
                  {STATUS_LABEL[item.status]}
                </span>
                <span className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      useQueueStore.getState().complete(item.filePath);
                    }}
                    className="p-0.5 text-green-400 hover:text-green-300"
                    title="완료"
                  >
                    <Check size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      useQueueStore.getState().skip(item.filePath);
                    }}
                    className="p-0.5 text-gray-400 hover:text-gray-200"
                    title="스킵"
                  >
                    <SkipForward size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      useQueueStore.getState().defer(item.filePath);
                    }}
                    className="p-0.5 text-purple-400 hover:text-purple-300"
                    title="보류"
                  >
                    <Bookmark size={12} />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
