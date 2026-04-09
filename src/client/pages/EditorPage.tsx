import { useState, useCallback } from 'react';
import { useEditorStore } from '../stores/useEditorStore';
import { useAnalysisStore } from '../stores/useAnalysisStore';
import { MonacoEditor } from '../components/editor/MonacoEditor';
import { MonacoDiffEditor } from '../components/editor/MonacoDiffEditor';
import { AnalysisPanel } from '../components/analysis/AnalysisPanel';
import { ANALYZABLE_EXTENSIONS } from '@shared/constants';
import {
  MousePointerClick,
  PanelRightOpen,
  PanelRightClose,
  Code,
  GitCompareArrows,
  Save,
  Check,
  X,
  Loader2,
} from 'lucide-react';

export function EditorPage() {
  const { tabs, activeTabPath, viewMode, saving } = useEditorStore();
  const activeTab = tabs.find((t) => t.filePath === activeTabPath);
  const [showAnalysis, setShowAnalysis] = useState(true);

  // Monaco에서 라인 이동 (분석 패널 클릭 시)
  const handleClickLine = useCallback((_line: number) => {
    // Monaco 에디터에서 해당 라인으로 스크롤은 Monaco API를 통해 처리
    // 현재는 MonacoEditor 내부에서 revealLineInCenter를 직접 호출할 수 없으므로
    // 향후 ref를 통한 imperative 연동 예정
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
  const hasSuggestion = activeTab.suggestedContent !== null;

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

        {/* 우측 버튼 그룹 */}
        <div className="ml-auto flex items-center gap-1 px-2 shrink-0">
          {/* diff 모드 토글 */}
          {hasSuggestion && (
            <div className="flex items-center border border-gray-600 rounded overflow-hidden">
              <button
                onClick={() => useEditorStore.getState().setViewMode('code')}
                className={`px-2 py-1 text-xs flex items-center gap-1 transition-colors ${
                  viewMode === 'code' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
                title="코드 편집"
              >
                <Code size={12} /> 편집
              </button>
              <button
                onClick={() => useEditorStore.getState().setViewMode('diff')}
                className={`px-2 py-1 text-xs flex items-center gap-1 transition-colors ${
                  viewMode === 'diff' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
                title="변경사항 비교"
              >
                <GitCompareArrows size={12} /> diff
              </button>
            </div>
          )}

          {/* 저장 버튼 */}
          {activeTab.isDirty && (
            <button
              onClick={() => useEditorStore.getState().saveFile(activeTab.filePath)}
              disabled={saving}
              className="px-2 py-1 text-xs flex items-center gap-1 rounded bg-green-700 hover:bg-green-600 text-white disabled:opacity-50 transition-colors"
              title="파일 저장 (Ctrl+S)"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              저장
            </button>
          )}

          {/* 분석 패널 토글 */}
          {isAnalyzable && (
            <button
              onClick={() => setShowAnalysis((v) => !v)}
              className="px-2 py-1.5 text-gray-500 hover:text-gray-300 transition-colors"
              title={showAnalysis ? '분석 패널 닫기' : '분석 패널 열기'}
            >
              {showAnalysis ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            </button>
          )}
        </div>
      </div>

      {/* diff 모드일 때 수정 적용/취소 바 */}
      {viewMode === 'diff' && hasSuggestion && (
        <DiffActionBar filePath={activeTab.filePath} />
      )}

      {/* 메인 영역 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 에디터 영역 */}
        <div className="flex-1 overflow-hidden">
          {viewMode === 'diff' && hasSuggestion ? (
            <MonacoDiffEditor
              original={activeTab.content}
              modified={activeTab.suggestedContent!}
              language={activeTab.language}
            />
          ) : (
            <MonacoEditor
              value={activeTab.content}
              language={activeTab.language}
              onChange={(val) =>
                useEditorStore.getState().updateContent(activeTab.filePath, val)
              }
              highlightLines={getHighlightLines(activeTab.filePath)}
            />
          )}
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

/** diff 모드 액션 바 — 수정 적용 / 취소 */
function DiffActionBar({ filePath }: { filePath: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-800/80 border-b border-gray-700">
      <div className="text-xs text-gray-400">
        <GitCompareArrows size={14} className="inline mr-1.5" />
        자동 수정 프리뷰 — 왼쪽: 현재 코드 / 오른쪽: 수정 제안
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => useEditorStore.getState().clearSuggestedContent(filePath)}
          className="px-3 py-1 text-xs rounded border border-gray-600 text-gray-300 hover:bg-gray-700 flex items-center gap-1 transition-colors"
        >
          <X size={12} /> 취소
        </button>
        <button
          onClick={() => useEditorStore.getState().applySuggestion(filePath)}
          className="px-3 py-1 text-xs rounded bg-green-700 hover:bg-green-600 text-white flex items-center gap-1 transition-colors"
        >
          <Check size={12} /> 수정 적용
        </button>
      </div>
    </div>
  );
}

/** 분석 결과에서 하이라이트 라인 추출 */
function getHighlightLines(filePath: string) {
  const result = useAnalysisStore.getState().results[filePath];
  if (!result) return undefined;
  return result.matches.map((m) => ({ line: m.line, severity: m.severity }));
}

/** 탭 아이템 */
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
