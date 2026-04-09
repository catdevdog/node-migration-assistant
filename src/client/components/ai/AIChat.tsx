import { useRef, useEffect, useState, useCallback, useMemo, type KeyboardEvent } from 'react';
import { useAIStore } from '../../stores/useAIStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { streamAIRequest, estimateTokens } from '../../api/ai';
import { Send, Loader2, Coins, User, Bot, Code, ChevronDown } from 'lucide-react';
import type { AIChatMessage, AIRequestType, AITokenEstimate } from '@shared/types/ai';

/** 요청 유형별 레이블 */
const REQUEST_TYPE_LABELS: Record<AIRequestType, string> = {
  analyze: '코드 분석',
  rewrite: '파일 재작성',
  'replace-library': '라이브러리 교체',
  cascade: '연쇄 영향 분석',
  'explain-error': '에러 설명',
  'suggest-improvements': '개선 제안',
};

/** 채팅 인터페이스 — 메시지 목록 + 입력 영역 */
export function AIChat() {
  const {
    messages,
    currentStreamText,
    isStreaming,
    currentEstimate,
    addUserMessage,
    startStreaming,
    appendStreamChunk,
    completeStreaming,
    setStreamError,
    setEstimate,
  } = useAIStore();
  const apiKey = useSettingsStore((s) => s.apiKey);

  const [input, setInput] = useState('');
  const [requestType, setRequestType] = useState<AIRequestType>('analyze');
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [estimating, setEstimating] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const typeMenuRef = useRef<HTMLDivElement>(null);

  /* 자동 스크롤 */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStreamText]);

  /* textarea 높이 자동 조절 */
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  /* 드롭다운 외부 클릭 시 닫기 */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (typeMenuRef.current && !typeMenuRef.current.contains(e.target as Node)) {
        setShowTypeMenu(false);
      }
    }
    if (showTypeMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showTypeMenu]);

  /* 비용 사전 추정 (디바운스) */
  useEffect(() => {
    if (!input.trim() || !apiKey) {
      setEstimate(null);
      return;
    }

    const timer = setTimeout(async () => {
      setEstimating(true);
      try {
        const estimate = await estimateTokens(requestType, { content: input });
        setEstimate(estimate);
      } catch {
        // 추정 실패는 무시 — 전송은 가능
        setEstimate(null);
      } finally {
        setEstimating(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [input, requestType, apiKey, setEstimate]);

  /** 메시지 전송 */
  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming || !apiKey) return;

    // 사용자 메시지 추가
    addUserMessage(trimmed);
    setInput('');
    startStreaming();

    // SSE 스트리밍 요청
    abortRef.current = streamAIRequest(
      requestType,
      { content: trimmed },
      {
        onChunk: (text) => appendStreamChunk(text),
        onDone: (fullText, usage) => completeStreaming(fullText, usage),
        onError: (message) => setStreamError(message),
      },
    );
  }, [input, isStreaming, apiKey, requestType, addUserMessage, startStreaming, appendStreamChunk, completeStreaming, setStreamError]);

  /** Ctrl+Enter 전송 */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  /** 스트리밍 취소 */
  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setStreamError('사용자가 요청을 취소했습니다.');
  }, [setStreamError]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 custom-scrollbar">
        {messages.length === 0 && !isStreaming && (
          <EmptyState />
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* 스트리밍 중인 응답 */}
        {isStreaming && currentStreamText && (
          <div className="flex gap-2">
            <div className="shrink-0 w-6 h-6 rounded-full bg-purple-600/20 flex items-center justify-center mt-0.5">
              <Bot size={14} className="text-purple-400" />
            </div>
            <div className="flex-1 px-3 py-2 bg-gray-800 rounded-lg text-sm text-gray-200 leading-relaxed">
              <MessageContent content={currentStreamText} />
              <span className="inline-block w-1.5 h-4 bg-purple-400 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
            </div>
          </div>
        )}

        {/* 스트리밍 시작 대기 (청크 도착 전) */}
        {isStreaming && !currentStreamText && (
          <div className="flex gap-2">
            <div className="shrink-0 w-6 h-6 rounded-full bg-purple-600/20 flex items-center justify-center mt-0.5">
              <Bot size={14} className="text-purple-400" />
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg text-sm text-gray-400">
              <Loader2 size={14} className="animate-spin" />
              <span>생각 중...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 입력 영역 */}
      <div className="border-t border-gray-700 bg-gray-800/50 px-3 py-3">
        {/* 비용 추정 배지 */}
        <EstimateBadge estimate={currentEstimate} estimating={estimating} />

        <div className="flex items-end gap-2">
          {/* 요청 유형 드롭다운 */}
          <div className="relative" ref={typeMenuRef}>
            <button
              onClick={() => setShowTypeMenu((v) => !v)}
              className="flex items-center gap-1 px-2 py-1.5 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors whitespace-nowrap"
              title="요청 유형 선택"
            >
              <Code size={12} className="text-purple-400" />
              <span>{REQUEST_TYPE_LABELS[requestType]}</span>
              <ChevronDown size={10} className={`transition-transform ${showTypeMenu ? 'rotate-180' : ''}`} />
            </button>

            {showTypeMenu && (
              <div className="absolute bottom-full left-0 mb-1 w-44 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-10 py-1 overflow-hidden">
                {(Object.entries(REQUEST_TYPE_LABELS) as [AIRequestType, string][]).map(
                  ([type, label]) => (
                    <button
                      key={type}
                      onClick={() => {
                        setRequestType(type);
                        setShowTypeMenu(false);
                      }}
                      className={`
                        w-full text-left px-3 py-1.5 text-xs transition-colors
                        ${type === requestType
                          ? 'bg-purple-600/20 text-purple-300'
                          : 'text-gray-300 hover:bg-gray-700'
                        }
                      `}
                    >
                      {label}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>

          {/* 텍스트 입력 */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={apiKey ? '분석할 내용을 입력하세요... (Ctrl+Enter 전송)' : 'API 키를 먼저 설정하세요'}
            disabled={!apiKey || isStreaming}
            rows={1}
            className="
              flex-1 resize-none bg-gray-700/50 border border-gray-600 rounded-lg
              px-3 py-2 text-sm text-gray-200 placeholder-gray-500
              focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors custom-scrollbar
            "
          />

          {/* 전송 / 취소 버튼 */}
          {isStreaming ? (
            <button
              onClick={handleCancel}
              className="shrink-0 p-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition-colors"
              title="응답 취소"
            >
              <Loader2 size={16} className="animate-spin" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() || !apiKey}
              className="
                shrink-0 p-2 rounded-lg
                bg-purple-600 hover:bg-purple-500 text-white
                disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed
                transition-colors
              "
              title="메시지 전송 (Ctrl+Enter)"
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** 빈 상태 안내 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
      <div className="w-12 h-12 rounded-full bg-purple-600/20 flex items-center justify-center mb-4">
        <Bot size={24} className="text-purple-400" />
      </div>
      <p className="text-sm font-medium text-gray-300 mb-1">AI 어시스턴트</p>
      <p className="text-xs text-gray-500 leading-relaxed max-w-[280px]">
        규칙 엔진이 감지한 이슈 중 복잡한 문제를 AI에게 분석 요청하거나,
        코드 리라이트, 에러 설명 등을 요청할 수 있습니다.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-1.5">
        {['코드 분석', '파일 재작성', '에러 설명', '개선 제안'].map((label) => (
          <span
            key={label}
            className="px-2 py-0.5 text-[10px] rounded-full bg-purple-600/10 text-purple-400 border border-purple-500/20"
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** 비용 추정 배지 */
function EstimateBadge({
  estimate,
  estimating,
}: {
  estimate: AITokenEstimate | null;
  estimating: boolean;
}) {
  if (!estimate && !estimating) return null;

  return (
    <div className="flex items-center gap-2 mb-2">
      {estimating ? (
        <span className="flex items-center gap-1 text-[10px] text-gray-500">
          <Loader2 size={10} className="animate-spin" />
          비용 추정 중...
        </span>
      ) : estimate ? (
        <>
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-700/50 text-[10px] text-gray-400">
            <Coins size={10} className="text-yellow-500" />
            ~{(estimate.estimatedInputTokens + estimate.estimatedOutputTokens).toLocaleString()} 토큰
            <span className="text-yellow-500">${estimate.estimatedCostUSD.toFixed(4)}</span>
          </span>
          {estimate.warning && (
            <span className="text-[10px] text-amber-400">{estimate.warning}</span>
          )}
        </>
      ) : null}
    </div>
  );
}

/** 메시지 버블 */
function MessageBubble({ message }: { message: AIChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex gap-2 justify-end">
        <div className="max-w-[85%] px-3 py-2 bg-purple-900/30 border border-purple-700/30 rounded-lg text-sm text-gray-200 leading-relaxed">
          <MessageContent content={message.content} />
        </div>
        <div className="shrink-0 w-6 h-6 rounded-full bg-gray-600/40 flex items-center justify-center mt-0.5">
          <User size={14} className="text-gray-400" />
        </div>
      </div>
    );
  }

  /* assistant 메시지 */
  return (
    <div className="flex gap-2">
      <div className="shrink-0 w-6 h-6 rounded-full bg-purple-600/20 flex items-center justify-center mt-0.5">
        <Bot size={14} className="text-purple-400" />
      </div>
      <div className="max-w-[85%] flex flex-col gap-1">
        <div className="px-3 py-2 bg-gray-800 border border-gray-700/50 rounded-lg text-sm text-gray-200 leading-relaxed">
          <MessageContent content={message.content} />
        </div>

        {/* 토큰 사용량 배지 */}
        {message.usage && (
          <div className="flex items-center gap-1 text-[10px] text-gray-500 pl-1">
            <Coins size={10} className="text-yellow-600" />
            <span>
              {(message.usage.inputTokens + message.usage.outputTokens).toLocaleString()} 토큰
            </span>
            <span className="text-yellow-600">${message.usage.estimatedCostUSD.toFixed(4)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** 메시지 콘텐츠 렌더러 — 코드 블록을 감지하여 별도 스타일 적용 */
function MessageContent({ content }: { content: string }) {
  const parts = useMemo(() => parseMessageContent(content), [content]);

  return (
    <>
      {parts.map((part, i) =>
        part.type === 'code' ? (
          <div key={i} className="my-2 rounded overflow-hidden">
            {part.language && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-950 text-[10px] text-gray-500 border-b border-gray-700">
                <Code size={10} />
                <span>{part.language}</span>
              </div>
            )}
            <pre className="px-3 py-2 bg-gray-900 text-xs font-mono text-gray-300 overflow-x-auto custom-scrollbar leading-relaxed">
              <code>{part.content}</code>
            </pre>
          </div>
        ) : (
          <span key={i} className="whitespace-pre-wrap">{part.content}</span>
        ),
      )}
    </>
  );
}

/** 메시지 텍스트에서 ```코드``` 블록 파싱 */
interface ContentPart {
  type: 'text' | 'code';
  content: string;
  language?: string;
}

function parseMessageContent(content: string): ContentPart[] {
  const parts: ContentPart[] = [];
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    /* 코드 블록 앞의 텍스트 */
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: content.slice(lastIndex, match.index) });
    }

    /* 코드 블록 */
    parts.push({
      type: 'code',
      language: match[1] || undefined,
      content: match[2],
    });

    lastIndex = match.index + match[0].length;
  }

  /* 마지막 텍스트 */
  if (lastIndex < content.length) {
    parts.push({ type: 'text', content: content.slice(lastIndex) });
  }

  /* 내용이 없으면 전체를 텍스트로 */
  if (parts.length === 0) {
    parts.push({ type: 'text', content });
  }

  return parts;
}
