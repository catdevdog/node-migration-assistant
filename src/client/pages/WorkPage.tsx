import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  Wrench,
  X,
  GitCompareArrows,
  AlertTriangle,
  SkipForward,
  Bookmark,
  Bot,
  Code,
  MousePointerClick,
} from 'lucide-react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { MonacoEditor } from '../components/editor/MonacoEditor';
import { MonacoDiffEditor } from '../components/editor/MonacoDiffEditor';
import { RuleMatchCard } from '../components/analysis/RuleMatchCard';
import { useEditorStore } from '../stores/useEditorStore';
import { useAnalysisStore } from '../stores/useAnalysisStore';
import { useQueueStore, type QueueRisk } from '../stores/useQueueStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useProjectStore } from '../stores/useProjectStore';
import { useAIStore } from '../stores/useAIStore';
import { useUIStore } from '../stores/useUIStore';
import { streamAIRequest } from '../api/ai';
import { useShortcuts } from '../hooks/useShortcuts';
import { ANALYZABLE_EXTENSIONS } from '@shared/constants';
import { apiClient } from '../api/client';
import type { ImportGraph } from '@shared/types/dependency';

/** 위험도 색상 */
const RISK_DOT: Record<QueueRisk, string> = {
  high: 'bg-red-500',
  medium: 'bg-orange-500',
  low: 'bg-yellow-500',
};

/** AI 응답에서 설명 텍스트와 코드 블록 분리 */
function parseAIResponse(text: string): { explanation: string; codeBlocks: { lang: string; code: string }[] } {
  const codeBlocks: { lang: string; code: string }[] = [];
  const explanation = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    codeBlocks.push({ lang: lang || 'text', code: code.trim() });
    return '';
  }).trim();
  return { explanation, codeBlocks };
}

/** 간이 마크다운 → HTML 변환 (AI 응답 표시용) */
function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-gray-700 text-gray-200 text-[11px]">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-gray-100 font-semibold">$1</strong>')
    .replace(/^### (.+)$/gm, '<div class="text-xs font-semibold text-gray-200 mt-2 mb-1">$1</div>')
    .replace(/^## (.+)$/gm, '<div class="text-sm font-bold text-gray-200 mt-3 mb-1">$1</div>')
    .replace(/^[-*] (.+)$/gm, '<div class="ml-3 text-gray-300">\u2022 $1</div>')
    .replace(/\n\n/g, '<br/>')
    .replace(/\n/g, '<br/>');
}

/** 간이 glob 매치 — `src/auth/**` 패턴만 지원 (minimatch 대신) */
function matchGlob(filePath: string, pattern: string): boolean {
  // "src/auth/**" → "src/auth/"로 변환해서 startsWith 체크
  const base = pattern.replace(/\*+$/, '').replace(/\/+$/, '/');
  return filePath.startsWith(base) || filePath === base.replace(/\/$/, '');
}

export function WorkPage() {
  const items = useQueueStore((s) => s.items);
  const activeIndex = useQueueStore((s) => s.activeIndex);
  const { tabs, activeTabPath, viewMode, saving } = useEditorStore();
  const activeTab = tabs.find((t) => t.filePath === activeTabPath);
  const targetNodeVersion = useSettingsStore((s) => s.targetNodeVersion);
  const scopePatterns = useSettingsStore((s) => s.scopePatterns);
  const currentNodeVersion = useProjectStore((s) => s.projectInfo?.currentNodeVersion ?? null);

  // 분석 스토어
  const results = useAnalysisStore((s) => s.results);
  const analyzingFile = useAnalysisStore((s) => s.analyzingFile);
  const analyzeFile = useAnalysisStore((s) => s.analyzeFile);

  // AI 스토어
  const isStreaming = useAIStore((s) => s.isStreaming);
  const currentStreamText = useAIStore((s) => s.currentStreamText);
  const messages = useAIStore((s) => s.messages);

  // 영향도
  const [reverseMap, setReverseMap] = useState<Record<string, string[]>>({});
  const [loadingGraph, setLoadingGraph] = useState(false);

  // Monaco 에디터 인스턴스 (라인 이동용)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const monacoEditorRef = useRef<any>(null);
  // AI 코드 diff 토글 상태
  const [showAIDiff, setShowAIDiff] = useState(false);
  // Cascade 상태
  const [cascadeFiles, setCascadeFiles] = useState<string[]>([]);
  const [showCascade, setShowCascade] = useState(false);
  // AI Cascade 스트리밍
  const [cascadeAIText, setCascadeAIText] = useState('');
  const [cascadeAIStreaming, setCascadeAIStreaming] = useState(false);

  // 단축키 등록
  useShortcuts();

  // import 그래프에서 reverseImports 가져오기 (1회)
  useEffect(() => {
    setLoadingGraph(true);
    apiClient.post<ImportGraph>('/deps/graph', { targetNodeVersion })
      .then((graph) => setReverseMap(graph.reverseImports))
      .catch(() => setReverseMap({}))
      .finally(() => setLoadingGraph(false));
  }, [targetNodeVersion]);

  // 파일 열릴 때 자동 분석
  useEffect(() => {
    if (!activeTabPath) return;
    const ext = '.' + activeTabPath.split('.').pop();
    if (!ANALYZABLE_EXTENSIONS.includes(ext)) return;
    if (!results[activeTabPath] && analyzingFile !== activeTabPath) {
      analyzeFile(activeTabPath, targetNodeVersion, currentNodeVersion ?? undefined);
    }
  }, [activeTabPath]);

  // 분석 결과 나오면 fixable이면 자동 제안 설정
  const result = activeTabPath ? results[activeTabPath] ?? null : null;
  useEffect(() => {
    if (result?.fixedContent && activeTabPath) {
      const tab = useEditorStore.getState().tabs.find((t) => t.filePath === activeTabPath);
      if (tab && !tab.suggestedContent) {
        useEditorStore.getState().setSuggestedContent(activeTabPath, result.fixedContent);
      }
    }
  }, [result?.fixedContent, activeTabPath]);

  // 파일 변경 시 AI diff 토글 리셋
  useEffect(() => {
    setShowAIDiff(false);
  }, [activeTabPath]);

  /** 범위 안/밖 영향 파일 분류 */
  const impactFiles = useMemo(() => {
    if (!activeTabPath || !reverseMap[activeTabPath]) return { inScope: [], outScope: [] };
    const affected = reverseMap[activeTabPath];
    const patterns = scopePatterns.split(',').map((p) => p.trim()).filter(Boolean);

    if (patterns.length === 0) {
      return { inScope: affected, outScope: [] };
    }

    const inScope: string[] = [];
    const outScope: string[] = [];
    for (const f of affected) {
      if (patterns.some((p) => matchGlob(f, p))) {
        inScope.push(f);
      } else {
        outScope.push(f);
      }
    }
    return { inScope, outScope };
  }, [activeTabPath, reverseMap, scopePatterns]);

  /** AI 응답 파싱 (마지막 어시스턴트 메시지) */
  const lastAssistantMsg = useMemo(
    () => messages.filter((m) => m.role === 'assistant').slice(-1)[0] ?? null,
    [messages],
  );
  const parsedAI = useMemo(
    () => lastAssistantMsg ? parseAIResponse(lastAssistantMsg.content) : null,
    [lastAssistantMsg],
  );

  /** 라인 클릭 → Monaco 이동 + 깜박임 하이라이트 */
  const handleLineClick = useCallback((line: number) => {
    const ed = monacoEditorRef.current;
    if (!ed) return;
    try {
      ed.revealLineInCenter(line);
      ed.setPosition({ lineNumber: line, column: 1 });
      const coll = ed.createDecorationsCollection([{
        range: { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: 1 },
        options: { isWholeLine: true, className: 'line-blink-highlight' },
      }]);
      setTimeout(() => { try { coll.clear(); } catch { /* 무시 */ } }, 1500);
    } catch { /* 에디터 미활성 */ }
  }, []);

  /** 큐 내비 */
  const handlePrev = () => {
    useQueueStore.getState().prev();
    const q = useQueueStore.getState();
    const item = q.items[q.activeIndex];
    if (item) void useEditorStore.getState().openFile(item.filePath);
  };
  const handleNext = () => {
    useQueueStore.getState().next();
    const q = useQueueStore.getState();
    const item = q.items[q.activeIndex];
    if (item) void useEditorStore.getState().openFile(item.filePath);
  };

  /** cascade 체크 — 승인 후 영향 파일 감지 */
  const checkCascade = (filePath: string) => {
    const affected = reverseMap[filePath] ?? [];
    // 이미 큐에 있는 파일은 제외
    const queuePaths = new Set(useQueueStore.getState().items.map((i) => i.filePath));
    const newAffected = affected.filter((f) => !queuePaths.has(f));
    if (newAffected.length > 0) {
      setCascadeFiles(newAffected);
      setShowCascade(true);
      setCascadeAIText('');
      setCascadeAIStreaming(false);
    }
  };

  /** cascade 파일 큐에 추가 */
  const handleCascadeAdd = () => {
    const newItems = cascadeFiles.map((f) => ({
      filePath: f,
      riskLevel: 'medium' as const,
      source: 'cascade' as const,
      status: 'pending' as const,
      issueCount: 0,
    }));
    useQueueStore.getState().addItems(newItems);
    setShowCascade(false);
    setCascadeFiles([]);
  };

  /** cascade AI 분석 */
  const handleCascadeAI = () => {
    if (!activeTabPath || !activeTab || cascadeFiles.length === 0) return;
    setCascadeAIStreaming(true);
    setCascadeAIText('');

    // 영향 파일 내용을 읽어올 수 없으므로 경로만 전달
    const relatedFiles = cascadeFiles.map((f) => {
      const tab = useEditorStore.getState().tabs.find((t) => t.filePath === f);
      return { path: f, content: tab?.content ?? '(파일 내용 미로드)' };
    });

    streamAIRequest('cascade', {
      filePath: activeTabPath,
      originalContent: activeTab.content,
      changedContent: activeTab.suggestedContent ?? activeTab.content,
      relatedFiles,
    }, {
      onChunk: (t) => setCascadeAIText((prev) => prev + t),
      onDone: () => setCascadeAIStreaming(false),
      onError: (msg) => { setCascadeAIText(`❌ ${msg}`); setCascadeAIStreaming(false); },
    });
  };

  /** 규칙 자동수정 일괄 승인 (diff 안 봄) */
  const handleAutoFixAll = async () => {
    if (!activeTabPath || !result?.fixedContent) return;
    setShowAIDiff(false);
    useEditorStore.getState().setSuggestedContent(activeTabPath, result.fixedContent);
    await useEditorStore.getState().approveSuggestion(activeTabPath);
    useQueueStore.getState().complete(activeTabPath);
    checkCascade(activeTabPath);
    handleNext();
  };

  /** 제안 승인 */
  const handleApprove = async () => {
    if (!activeTabPath) return;
    await useEditorStore.getState().approveSuggestion(activeTabPath);
    setShowAIDiff(false);
    useQueueStore.getState().complete(activeTabPath);
    checkCascade(activeTabPath);
    handleNext();
  };

  /** AI 분석 요청 — 규칙 수정 반영 + AI 이슈만 전달 */
  const handleAIAnalyze = () => {
    if (!activeTabPath || !activeTab) return;

    // 규칙 자동수정이 있으면 그 코드를 베이스로 사용 (규칙 수정 포함 상태)
    const baseContent = result?.fixedContent ?? activeTab.content;
    // AI 필요 이슈만 필터하여 전달
    const aiMatches = (result?.matches ?? [])
      .filter((m) => m.needsAI)
      .map((m) => ({
        ruleId: m.ruleId,
        line: m.line,
        message: m.message,
        aiReason: m.aiReason,
      }));

    const store = useAIStore.getState();
    store.addUserMessage(
      `파일 분석 요청: ${activeTabPath}\n마이그레이션: Node ${currentNodeVersion ?? '?'} → ${targetNodeVersion}`,
      { filePath: activeTabPath, code: baseContent, language: activeTab.language },
    );
    store.startStreaming();
    streamAIRequest('analyze', {
      filePath: activeTabPath,
      content: baseContent,
      matches: aiMatches,
      targetNodeVersion,
      currentNodeVersion,
    }, {
      onChunk: (t) => useAIStore.getState().appendStreamChunk(t),
      onDone: (fullText, usage) => useAIStore.getState().completeStreaming(fullText, usage),
      onError: (msg) => useAIStore.getState().setStreamError(msg),
    });
  };

  /** AI 코드 diff 토글 */
  const handleAIToggle = () => {
    if (!activeTabPath || !parsedAI?.codeBlocks.length) return;
    if (showAIDiff) {
      useEditorStore.getState().clearSuggestedContent(activeTabPath);
      setShowAIDiff(false);
    } else {
      // 가장 긴 코드 블록 선택 — 전체 파일 수정 코드일 가능성이 가장 높음
      const longest = parsedAI.codeBlocks.reduce((a, b) =>
        a.code.length > b.code.length ? a : b,
      );
      useEditorStore.getState().setSuggestedContent(activeTabPath, longest.code);
      setShowAIDiff(true);
    }
  };

  const hasSuggestion = activeTab?.suggestedContent !== null && activeTab?.suggestedContent !== undefined;
  const isAnalyzing = activeTabPath === analyzingFile;
  const pendingCount = items.filter((i) => i.status === 'pending').length;
  const completedCount = items.filter((i) => i.status === 'completed').length;

  // 큐가 비어있고 파일도 안 열려있으면
  if (items.length === 0 && !activeTab) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
        <MousePointerClick size={40} className="text-gray-600" />
        <p className="text-sm">큐가 비어있습니다. 준비 화면에서 스캔 후 작업을 시작하세요.</p>
        <button
          onClick={() => useUIStore.getState().setActivePage('setup')}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          ← 준비 화면으로
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 메인 3칸 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 좌: 큐 */}
        <div className="w-[200px] border-r border-gray-700 bg-[rgb(22,27,34)] flex flex-col shrink-0">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/60 text-xs">
            <span className="text-gray-400">{completedCount}/{items.length}</span>
            <div className="flex gap-1">
              <button onClick={handlePrev} className="text-gray-500 hover:text-gray-300" title="이전 (Ctrl+[)">
                <ChevronLeft size={14} />
              </button>
              <button onClick={handleNext} className="text-gray-500 hover:text-gray-300" title="다음 (Ctrl+])">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
          <ul className="flex-1 overflow-y-auto custom-scrollbar">
            {items.map((item, idx) => {
              const isActive = idx === activeIndex;
              const dimmed = item.status === 'completed' || item.status === 'skipped';
              const fileName = item.filePath.split('/').pop() ?? item.filePath;
              return (
                <li
                  key={item.filePath}
                  onClick={async () => {
                    useQueueStore.getState().jumpTo(idx);
                    await useEditorStore.getState().openFile(item.filePath);
                  }}
                  className={`
                    group flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer
                    border-l-2 transition-colors
                    ${isActive ? 'bg-blue-900/30 border-blue-500' : 'border-transparent hover:bg-gray-800/60'}
                    ${dimmed ? 'opacity-40' : ''}
                  `}
                  title={item.filePath}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${RISK_DOT[item.riskLevel]}`} />
                  <span className="truncate flex-1 text-gray-300">{fileName}</span>
                  {item.status === 'completed' && <Check size={10} className="text-green-400 shrink-0" />}
                  {/* 호버 액션 */}
                  <span className="hidden group-hover:flex gap-0.5 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); useQueueStore.getState().skip(item.filePath); }}
                      className="text-gray-500 hover:text-gray-300" title="스킵">
                      <SkipForward size={10} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); useQueueStore.getState().defer(item.filePath); }}
                      className="text-gray-500 hover:text-purple-300" title="보류">
                      <Bookmark size={10} />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* 중앙 + 우측: 리사이즈 가능 */}
        <PanelGroup autoSaveId="node-migrator-work" direction="horizontal" className="flex-1">
          {/* 중: 코드 */}
          <Panel defaultSize={70} minSize={40}>
            <div className="flex flex-col h-full overflow-hidden">
              {/* diff 모드 헤더 */}
              {viewMode === 'diff' && hasSuggestion && (
                <div className="flex items-center justify-between px-4 py-2 bg-gray-800/80 border-b border-gray-700 text-xs">
                  <span className="text-gray-400 flex items-center gap-1.5">
                    <GitCompareArrows size={14} />
                    왼쪽: 현재 / 오른쪽: {showAIDiff ? 'AI 제안' : '수정안'}
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => {
                      setShowAIDiff(false);
                      useEditorStore.getState().clearSuggestedContent(activeTabPath!);
                    }}
                      className="flex items-center gap-1 px-2 py-1 rounded border border-gray-600 text-gray-300 hover:bg-gray-700">
                      <X size={12} /> 취소
                    </button>
                    <button onClick={handleApprove} disabled={saving}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-green-700 hover:bg-green-600 text-white disabled:opacity-50">
                      {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      승인 (Ctrl+S)
                    </button>
                  </div>
                </div>
              )}

              {/* Monaco */}
              <div className="flex-1 overflow-hidden">
                {!activeTab ? (
                  <div className="flex items-center justify-center h-full text-gray-600 text-sm">
                    큐에서 파일을 선택하세요
                  </div>
                ) : viewMode === 'diff' && hasSuggestion ? (
                  <MonacoDiffEditor
                    original={activeTab.content}
                    modified={activeTab.suggestedContent!}
                    language={activeTab.language}
                  />
                ) : (
                  <MonacoEditor
                    value={activeTab.content}
                    language={activeTab.language}
                    highlightLines={result?.matches.map((m) => ({ line: m.line, severity: m.severity }))}
                    onEditorReady={(ed) => { monacoEditorRef.current = ed; }}
                  />
                )}
              </div>
            </div>
          </Panel>

          {/* 리사이즈 핸들 */}
          <PanelResizeHandle className="w-1 bg-gray-700 hover:bg-blue-500 transition-colors cursor-col-resize" />

          {/* 우: 이슈 + 영향도 + AI */}
          <Panel defaultSize={30} minSize={15} maxSize={50}>
            <div className="border-l border-gray-700 flex flex-col h-full overflow-hidden">
              {activeTab && (
                <>
                  {/* 이슈 목록 */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {isAnalyzing && (
                      <div className="flex items-center justify-center py-8 text-gray-500 text-xs">
                        <Loader2 size={16} className="animate-spin mr-2" /> 분석 중...
                      </div>
                    )}

                    {result && !isAnalyzing && (
                      <div className="p-2 space-y-2">
                        {/* 요약 한 줄 */}
                        <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-gray-400">
                          <span className="font-medium text-gray-200">{result.summary.total}개 이슈</span>
                          {result.summary.fixable > 0 && (
                            <span className="text-green-400">⚡{result.summary.fixable}</span>
                          )}
                          {result.summary.needsAI > 0 && (
                            <span className="text-purple-400">AI {result.summary.needsAI}</span>
                          )}
                        </div>

                        {/* 이슈 카드 — 라인 클릭 시 Monaco 이동 */}
                        {result.matches.map((match, i) => (
                          <RuleMatchCard
                            key={`${match.ruleId}-${match.line}-${i}`}
                            match={match}
                            onClickLine={handleLineClick}
                          />
                        ))}

                        {result.summary.total === 0 && (
                          <div className="text-xs text-green-400 px-2 py-4 text-center">
                            ✓ 이슈 없음
                          </div>
                        )}
                      </div>
                    )}

                    {/* 영향도 */}
                    {(impactFiles.inScope.length > 0 || impactFiles.outScope.length > 0) && (
                      <div className="border-t border-gray-700 p-2 space-y-1">
                        <div className="text-xs text-gray-500 px-2 py-1 font-medium">영향 받는 파일</div>
                        {impactFiles.inScope.map((f) => (
                          <div key={f} className="flex items-center gap-2 px-2 py-1 text-xs text-gray-300 hover:bg-gray-800 rounded cursor-pointer"
                            onClick={() => useEditorStore.getState().openFile(f)}>
                            <Check size={10} className="text-green-400 shrink-0" />
                            <span className="truncate font-mono">{f}</span>
                            <span className="text-[9px] text-green-500 shrink-0">범위 안</span>
                          </div>
                        ))}
                        {impactFiles.outScope.map((f) => (
                          <div key={f} className="flex items-center gap-2 px-2 py-1 text-xs text-gray-500">
                            <AlertTriangle size={10} className="text-yellow-500 shrink-0" />
                            <span className="truncate font-mono">{f}</span>
                            <span className="text-[9px] text-yellow-500 shrink-0">범위 밖</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Cascade 알림 */}
                    {showCascade && cascadeFiles.length > 0 && (
                      <div className="border-t border-gray-700 p-2 space-y-2">
                        <div className="text-xs text-orange-400 px-2 py-1 font-medium flex items-center gap-1.5">
                          <AlertTriangle size={12} /> 연쇄 영향 감지 ({cascadeFiles.length}개 파일)
                        </div>
                        <div className="space-y-0.5">
                          {cascadeFiles.map((f) => (
                            <div key={f} className="flex items-center gap-2 px-2 py-1 text-xs text-gray-300 hover:bg-gray-800 rounded cursor-pointer"
                              onClick={() => useEditorStore.getState().openFile(f)}>
                              <span className="truncate font-mono flex-1">{f}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 px-2">
                          <button onClick={handleCascadeAdd}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-orange-700 hover:bg-orange-600 text-white text-xs transition-colors">
                            큐에 추가
                          </button>
                          <button onClick={handleCascadeAI} disabled={cascadeAIStreaming}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-purple-700 hover:bg-purple-600 text-white text-xs disabled:opacity-50 transition-colors">
                            <Sparkles size={11} /> AI 영향 분석
                          </button>
                          <button onClick={() => { setShowCascade(false); setCascadeFiles([]); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-gray-600 text-gray-400 hover:bg-gray-700 text-xs transition-colors">
                            무시
                          </button>
                        </div>
                        {/* Cascade AI 응답 */}
                        {(cascadeAIStreaming || cascadeAIText) && (
                          <div className="px-2 text-xs text-gray-300 leading-relaxed max-h-[200px] overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                            <div dangerouslySetInnerHTML={{
                              __html: cascadeAIText
                                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                                .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-gray-700 text-gray-200 text-[11px]">$1</code>')
                                .replace(/\*\*(.+?)\*\*/g, '<strong class="text-gray-100 font-semibold">$1</strong>')
                                .replace(/^[-*] (.+)$/gm, '<div class="ml-3 text-gray-300">\u2022 $1</div>')
                                .replace(/\n\n/g, '<br/>').replace(/\n/g, '<br/>'),
                            }} />
                            {cascadeAIStreaming && <span className="animate-pulse text-purple-400">▌</span>}
                          </div>
                        )}
                      </div>
                    )}

                    {/* AI 응답 */}
                    {(isStreaming || lastAssistantMsg) && (
                      <div className="border-t border-gray-700 p-2 space-y-2">
                        <div className="text-xs text-gray-500 px-2 py-1 font-medium flex items-center gap-1.5">
                          <Bot size={12} className="text-purple-400" /> AI 응답
                        </div>

                        {/* 완료된 메시지 — 마크다운 렌더링 + 코드 분리 */}
                        {parsedAI && !isStreaming && (
                          <>
                            <div
                              className="px-2 text-xs text-gray-300 leading-relaxed max-h-[300px] overflow-y-auto custom-scrollbar"
                              dangerouslySetInnerHTML={{ __html: renderMarkdown(parsedAI.explanation) }}
                            />
                            {/* 코드 비교 토글 버튼 */}
                            {parsedAI.codeBlocks.length > 0 && (
                              <button
                                onClick={handleAIToggle}
                                className={`flex items-center gap-1.5 mx-2 px-2.5 py-1.5 rounded text-xs transition-colors ${
                                  showAIDiff
                                    ? 'bg-blue-700 text-white'
                                    : 'border border-gray-600 text-gray-400 hover:text-gray-300 hover:bg-gray-700'
                                }`}
                              >
                                <Code size={12} />
                                {showAIDiff ? '코드 닫기' : '코드 비교'}
                                <span className="text-[10px] opacity-70">({parsedAI.codeBlocks.length})</span>
                              </button>
                            )}
                          </>
                        )}

                        {/* 스트리밍 중 — 원문 그대로 */}
                        {isStreaming && currentStreamText && (
                          <div className="px-2 text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                            {currentStreamText}
                            <span className="animate-pulse text-purple-400">▌</span>
                          </div>
                        )}
                        {isStreaming && !currentStreamText && (
                          <div className="px-2 text-xs text-gray-500 flex items-center gap-1.5">
                            <Loader2 size={12} className="animate-spin" /> 생각 중...
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 하단 액션바 */}
                  <div className="border-t border-gray-700 px-3 py-2 flex items-center gap-2 bg-gray-800/50">
                    {/* 규칙 자동수정 원클릭 */}
                    {result?.fixedContent && viewMode !== 'diff' && (
                      <button onClick={handleAutoFixAll}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-green-700 hover:bg-green-600 text-white text-xs transition-colors">
                        <Wrench size={12} /> 자동수정 ({result.summary.fixable})
                      </button>
                    )}
                    {/* diff 보기 */}
                    {result?.fixedContent && viewMode !== 'diff' && (
                      <button onClick={() => {
                        setShowAIDiff(false);
                        useEditorStore.getState().setSuggestedContent(activeTabPath!, result.fixedContent!);
                      }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-gray-600 text-gray-300 hover:bg-gray-700 text-xs transition-colors">
                        <Code size={12} /> diff 확인
                      </button>
                    )}
                    {/* AI 분석 */}
                    {result && result.summary.needsAI > 0 && (
                      <button onClick={handleAIAnalyze} disabled={isStreaming}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-purple-700 hover:bg-purple-600 text-white text-xs disabled:opacity-50 transition-colors">
                        <Sparkles size={12} /> AI 분석
                      </button>
                    )}
                    {/* 남은 건수 */}
                    <span className="ml-auto text-[10px] text-gray-500">{pendingCount}건 남음</span>
                  </div>
                </>
              )}
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
