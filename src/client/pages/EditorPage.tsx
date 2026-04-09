import { useState, useRef, useCallback } from 'react';
import { useEditorStore } from '../stores/useEditorStore';
import { AnalysisPanel } from '../components/analysis/AnalysisPanel';
import { ANALYZABLE_EXTENSIONS } from '@shared/constants';
import { FileCode, MousePointerClick, PanelRightOpen, PanelRightClose } from 'lucide-react';

export function EditorPage() {
  const { tabs, activeTabPath } = useEditorStore();
  const activeTab = tabs.find((t) => t.filePath === activeTabPath);
  const [showAnalysis, setShowAnalysis] = useState(true);
  const codeRef = useRef<HTMLPreElement>(null);

  // 분석 패널에서 라인 클릭 시 해당 라인으로 스크롤
  const handleClickLine = useCallback((line: number) => {
    if (!codeRef.current) return;
    const lineElements = codeRef.current.querySelectorAll('.code-line');
    const target = lineElements[line - 1];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('bg-yellow-900/30');
      setTimeout(() => target.classList.remove('bg-yellow-900/30'), 2000);
    }
  }, []);

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

  const ext = '.' + activeTab.filePath.split('.').pop();
  const isAnalyzable = ANALYZABLE_EXTENSIONS.includes(ext);

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
        {/* 분석 패널 토글 */}
        {isAnalyzable && (
          <button
            onClick={() => setShowAnalysis((v) => !v)}
            className="ml-auto px-2 py-1.5 text-gray-500 hover:text-gray-300 transition-colors shrink-0"
            title={showAnalysis ? '분석 패널 닫기' : '분석 패널 열기'}
          >
            {showAnalysis ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </button>
        )}
      </div>

      {/* 메인 영역: 코드 + 분석 패널 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 코드 뷰어 — Phase 4에서 Monaco Editor로 교체 예정 */}
        <div className="flex-1 overflow-auto bg-gray-900 p-4">
          <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
            <FileCode size={14} />
            <span>{activeTab.filePath}</span>
            <span className="text-gray-600">|</span>
            <span>{activeTab.language}</span>
            <span className="text-gray-600">|</span>
            <span>{(activeTab.content.length / 1024).toFixed(1)} KB</span>
          </div>
          <pre ref={codeRef} className="text-sm text-gray-300 font-mono leading-relaxed">
            {activeTab.content.split('\n').map((line, i) => (
              <div key={i} className="code-line flex transition-colors duration-300">
                <span className="select-none text-gray-600 w-10 text-right pr-3 shrink-0">
                  {i + 1}
                </span>
                <span className="whitespace-pre-wrap">{line}</span>
              </div>
            ))}
          </pre>
        </div>

        {/* 분석 패널 */}
        {isAnalyzable && showAnalysis && (
          <div className="w-[420px] border-l border-gray-700 bg-gray-850 shrink-0 overflow-hidden">
            <AnalysisPanel filePath={activeTab.filePath} onClickLine={handleClickLine} />
          </div>
        )}
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
