import { useEditorStore } from '../stores/useEditorStore';
import { FileCode, MousePointerClick } from 'lucide-react';

export function EditorPage() {
  const { tabs, activeTabPath } = useEditorStore();
  const activeTab = tabs.find((t) => t.filePath === activeTabPath);

  if (!activeTab) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <MousePointerClick size={48} className="mb-4 text-gray-600" />
        <p className="text-lg font-medium text-gray-400">파일을 선택하세요</p>
        <p className="text-sm mt-1">
          왼쪽 파일 탐색기에서 파일을 클릭하면 여기에 표시됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 탭 바 */}
      <div className="flex items-center bg-gray-800 border-b border-gray-700 overflow-x-auto">
        {tabs.map((tab) => (
          <TabItem
            key={tab.filePath}
            label={tab.label}
            active={tab.filePath === activeTabPath}
            dirty={tab.isDirty}
            onClick={() => useEditorStore.getState().setActiveTab(tab.filePath)}
            onClose={() => useEditorStore.getState().closeTab(tab.filePath)}
          />
        ))}
      </div>

      {/* 에디터 영역 — Phase 4에서 Monaco Editor로 교체 예정 */}
      <div className="flex-1 overflow-auto bg-gray-900 p-4">
        <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
          <FileCode size={14} />
          <span>{activeTab.filePath}</span>
          <span className="text-gray-600">|</span>
          <span>{activeTab.language}</span>
          <span className="text-gray-600">|</span>
          <span>{(activeTab.content.length / 1024).toFixed(1)} KB</span>
        </div>
        <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap leading-relaxed">
          {activeTab.content}
        </pre>
      </div>
    </div>
  );
}

function TabItem({
  label,
  active,
  dirty,
  onClick,
  onClose,
}: {
  label: string;
  active: boolean;
  dirty: boolean;
  onClick: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className={`
        flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer border-b-2
        shrink-0 group transition-colors
        ${active
          ? 'bg-gray-900 text-gray-200 border-blue-500'
          : 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-gray-800/50'
        }
      `}
      onClick={onClick}
    >
      <span className="truncate max-w-[120px]">{label}</span>
      {dirty && <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="ml-1 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-300 transition-opacity"
      >
        ×
      </button>
    </div>
  );
}
