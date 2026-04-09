import { useAIStore } from '../../stores/useAIStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { AIChat } from './AIChat';
import { CostTracker } from './CostTracker';
import {
  Bot,
  X,
  Trash2,
  AlertCircle,
} from 'lucide-react';

/** AI 어시스턴트 슬라이드 패널 — 에디터 우측에 표시 */
export function AIPanel() {
  const { isPanelOpen, isStreaming, error, totalUsage, clearMessages, setPanel, clearError } =
    useAIStore();
  const apiKey = useSettingsStore((s) => s.apiKey);

  if (!isPanelOpen) return null;

  return (
    <div className="w-[480px] border-l border-gray-700 bg-gray-850 flex flex-col h-full shrink-0">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-purple-400" />
          <span className="text-sm font-medium text-gray-200">AI 어시스턴트</span>
          {isStreaming && (
            <span className="text-xs text-purple-400 animate-pulse">응답 중...</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <CostTracker usage={totalUsage} />
          <button
            onClick={clearMessages}
            className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors"
            title="대화 초기화"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={() => setPanel(false)}
            className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors"
            title="패널 닫기"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* API 키 미설정 경고 */}
      {!apiKey && (
        <div className="mx-3 mt-3 px-3 py-2 bg-yellow-900/30 border border-yellow-700/50 rounded text-xs text-yellow-300 flex items-start gap-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>AI 기능을 사용하려면 설정 페이지에서 Anthropic API 키를 입력하세요.</span>
        </div>
      )}

      {/* 에러 표시 */}
      {error && (
        <div className="mx-3 mt-3 px-3 py-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300 flex items-start gap-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button
            onClick={clearError}
            className="ml-auto shrink-0 text-red-400 hover:text-red-200 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* 채팅 영역 */}
      <AIChat />
    </div>
  );
}
