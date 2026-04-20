import { useEffect, useMemo, useState, useRef } from 'react';
import {
  Search,
  Loader2,
  Play,
  AlertCircle,
  GitBranch,
  FolderOpen,
  Package,
  Bot,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useProjectStore } from '../stores/useProjectStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useUIStore } from '../stores/useUIStore';
import { useQueueStore, type QueueItem } from '../stores/useQueueStore';
import { useEditorStore } from '../stores/useEditorStore';
import { useDependencyStore } from '../stores/useDependencyStore';
import { streamAIRequest } from '../api/ai';
import type { FileAnalysisResult, ProjectScanSummary } from '@shared/types/analysis';
import type { DepInfo } from '@shared/types/dependency';

export function SetupPage() {
  const projectInfo = useProjectStore((s) => s.projectInfo);
  const targetNodeVersion = useSettingsStore((s) => s.targetNodeVersion);
  const scopePatterns = useSettingsStore((s) => s.scopePatterns);
  const setScopePatterns = useSettingsStore((s) => s.setScopePatterns);
  const setActivePage = useUIStore((s) => s.setActivePage);

  // 로컬 입력 상태 — 엔터 또는 스캔 버튼으로 확정
  const [inputValue, setInputValue] = useState(scopePatterns);

  // 스캔 상태
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [scanResults, setScanResults] = useState<FileAnalysisResult[]>([]);
  const [scanSummary, setScanSummary] = useState<ProjectScanSummary | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // 파일 선택 상태
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // 의존성 분석
  const depStore = useDependencyStore();
  const [depExpanded, setDepExpanded] = useState(false);
  const [depAIText, setDepAIText] = useState('');
  const [depAIStreaming, setDepAIStreaming] = useState(false);
  const [depAIDone, setDepAIDone] = useState(false);
  const depAIRef = useRef<AbortController | null>(null);

  /** 의존성 분석 실행 */
  const runDepAnalysis = () => {
    void depStore.analyze(targetNodeVersion);
  };

  /** 위험 의존성 AI 분석 */
  const runDepAI = () => {
    const risky = depStore.dependencies.filter(
      (d) => d.riskLevel === 'danger' || d.riskLevel === 'warning',
    );
    if (risky.length === 0) return;

    setDepAIText('');
    setDepAIStreaming(true);
    setDepAIDone(false);

    depAIRef.current = streamAIRequest('dependency', {
      packages: risky.map((d) => ({
        name: d.name,
        currentVersion: d.currentVersion,
        latestVersion: d.latestVersion,
        enginesNode: d.enginesNode,
        riskLevel: d.riskLevel,
        riskReason: d.riskReason,
        cveCount: d.cveCount,
        hasNativeAddon: d.hasNativeAddon,
      })),
      currentNodeVersion: projectInfo?.currentNodeVersion,
      targetNodeVersion,
    }, {
      onChunk: (t) => setDepAIText((prev) => prev + t),
      onDone: () => { setDepAIStreaming(false); setDepAIDone(true); },
      onError: (msg) => { setDepAIText(`❌ ${msg}`); setDepAIStreaming(false); },
    });
  };

  /** 위험 의존성 수 */
  const riskyDepCount = depStore.dependencies.filter(
    (d) => d.riskLevel === 'danger' || d.riskLevel === 'warning',
  ).length;

  /** SSE 기반 범위 스캔 */
  const runScopeScan = async (patterns: string) => {
    if (!projectInfo) return;
    setScanning(true);
    setScanError(null);
    setScanResults([]);
    setScanSummary(null);
    setScanProgress({ current: 0, total: 0 });
    // 패턴 저장 (persist)
    setScopePatterns(patterns);

    try {
      const res = await fetch('/api/file/analyze-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetNodeVersion,
          currentNodeVersion: projectInfo.currentNodeVersion,
          scopePatterns: patterns,
        }),
      });
      if (!res.ok) throw new Error(`스캔 실패: ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'progress') {
              setScanProgress({ current: data.current, total: data.total });
            } else if (data.type === 'done') {
              setScanResults(data.results ?? []);
              setScanSummary(data.summary ?? null);
            }
          } catch { /* JSON 파싱 실패 무시 */ }
        }
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : '스캔 실패');
    } finally {
      setScanning(false);
    }
  };

  // 프로젝트 로드 후 자동 스캔 (이전 scopePatterns가 있으면 재사용)
  useEffect(() => {
    if (projectInfo) {
      void runScopeScan(scopePatterns);
    }
  }, [projectInfo?.projectPath, targetNodeVersion]);

  /** 이슈 있는 파일만 필터 + 위험도별 정렬 */
  const issueFiles = useMemo(() => {
    return scanResults
      .filter((r) => r.summary.total > 0)
      .sort((a, b) => {
        // error 먼저, 그 다음 warning, 그 다음 info
        const scoreA = a.summary.errors * 100 + a.summary.warnings * 10 + a.summary.infos;
        const scoreB = b.summary.errors * 100 + b.summary.warnings * 10 + b.summary.infos;
        return scoreB - scoreA;
      });
  }, [scanResults]);

  /** 스캔 완료 후 자동 선택 (오류/경고 파일만) */
  useEffect(() => {
    const auto = new Set<string>();
    for (const r of issueFiles) {
      if (r.summary.errors > 0 || r.summary.warnings > 0) {
        auto.add(r.filePath);
      }
    }
    setSelected(auto);
  }, [issueFiles]);

  /** 파일 선택 토글 */
  const toggleFile = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  /** 전체 선택/해제 */
  const toggleAll = () => {
    if (selected.size === issueFiles.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(issueFiles.map((r) => r.filePath)));
    }
  };

  /** 작업 시작 — 선택된 파일만 큐에 추가 후 WorkPage로 */
  const handleStart = async () => {
    const queue = useQueueStore.getState();
    queue.reset();

    const selectedItems: QueueItem[] = [];
    for (const r of issueFiles) {
      if (!selected.has(r.filePath)) continue;
      let risk: QueueItem['riskLevel'] = 'low';
      if (r.summary.errors > 0) risk = 'high';
      else if (r.summary.warnings > 0) risk = 'medium';
      selectedItems.push({
        filePath: r.filePath,
        riskLevel: risk,
        source: 'preflight',
        status: 'pending',
        issueCount: r.summary.total,
      });
    }

    if (selectedItems.length > 0) {
      queue.addItems(selectedItems);
      const first = useQueueStore.getState().items[useQueueStore.getState().activeIndex];
      if (first) await useEditorStore.getState().openFile(first.filePath);
    }
    setActivePage('work');
  };

  const handleScan = () => {
    void runScopeScan(inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleScan();
    }
  };

  const gitDirty = projectInfo?.gitStatus?.hasUncommittedChanges;

  if (!projectInfo) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <Loader2 size={24} className="animate-spin mb-3" />
        <p className="text-sm">프로젝트 로딩 중...</p>
      </div>
    );
  }

  const totalIssues = scanSummary?.totalIssues ?? 0;
  const autoFixCount = issueFiles.reduce((s, r) => s + r.summary.fixable, 0);
  const aiCount = issueFiles.reduce((s, r) => s + r.summary.needsAI, 0);

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-gray-900">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-5">
        {/* 프로젝트 한 줄 요약 */}
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <FolderOpen size={16} className="text-blue-400" />
          <span className="text-gray-200 font-medium">{projectInfo.projectName}</span>
          <span>·</span>
          <span>Node {projectInfo.currentNodeVersion ?? '?'} → {targetNodeVersion}</span>
          <span>·</span>
          <span>{projectInfo.detectedFramework}</span>
        </div>

        {/* git 경고 */}
        {gitDirty && (
          <div className="flex items-center gap-2 px-3 py-2 rounded border border-yellow-700/60 bg-yellow-900/20 text-xs text-yellow-300">
            <GitBranch size={14} className="shrink-0" />
            커밋되지 않은 변경사항 있음 ({projectInfo.gitStatus?.currentBranch ?? '?'})
          </div>
        )}

        {/* 작업 범위 입력 */}
        <div className="space-y-2">
          <label className="text-xs text-gray-400">작업 범위 (glob 패턴, 쉼표 구분)</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="예: src/auth/**, src/api/** (비우면 전체)"
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleScan}
              disabled={scanning}
              className="px-4 py-2 rounded bg-blue-700 hover:bg-blue-600 text-white text-sm flex items-center gap-1.5 disabled:opacity-50 transition-colors"
            >
              {scanning ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              스캔
            </button>
          </div>
        </div>

        {/* 스캔 진행 */}
        {scanning && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Loader2 size={12} className="animate-spin" />
            분석 중 ({scanProgress.current}/{scanProgress.total})
          </div>
        )}
        {scanError && (
          <div className="flex items-center gap-2 text-xs text-red-400">
            <AlertCircle size={12} /> {scanError}
          </div>
        )}

        {/* 스캔 결과 요약 — 숫자 한 줄 */}
        {scanSummary && !scanning && (
          <div className="flex items-center gap-4 px-4 py-3 rounded border border-gray-700 bg-gray-800/50 text-sm">
            <span className="text-gray-400">
              <span className="text-gray-100 font-semibold">{scanSummary.analyzedFiles}</span>개 파일
            </span>
            <span className="text-red-400">🔴 {scanSummary.totalErrors}</span>
            <span className="text-yellow-400">🟠 {scanSummary.totalWarnings}</span>
            <span className="text-blue-400">🔵 {scanSummary.totalInfos}</span>
            <span className="text-gray-600">|</span>
            <span className="text-green-400">자동수정 {autoFixCount}</span>
            <span className="text-purple-400">AI {aiCount}</span>
          </div>
        )}

        {/* 이슈 파일 리스트 */}
        {issueFiles.length > 0 && !scanning && (
          <div className="space-y-1">
            {/* 헤더: 전체 선택 + 카운트 */}
            <div className="flex items-center gap-3 mb-2">
              <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selected.size === issueFiles.length && issueFiles.length > 0}
                  onChange={toggleAll}
                  className="accent-blue-500 w-3.5 h-3.5"
                />
                전체 선택
              </label>
              <span className="text-xs text-gray-500">
                ({selected.size}/{issueFiles.length}개 선택)
              </span>
            </div>

            {/* 파일 리스트 */}
            <div className="rounded border border-gray-700 bg-gray-800/30 divide-y divide-gray-700/50 max-h-[400px] overflow-y-auto custom-scrollbar">
              {issueFiles.map((r) => (
                <label
                  key={r.filePath}
                  className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-800/60 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(r.filePath)}
                    onChange={() => toggleFile(r.filePath)}
                    className="accent-blue-500 w-3.5 h-3.5 shrink-0"
                  />
                  <span className="text-gray-300 truncate flex-1 font-mono text-xs">
                    {r.filePath}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {r.summary.errors > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-900/40 text-red-400 border border-red-800/50">
                        오류 {r.summary.errors}
                      </span>
                    )}
                    {r.summary.warnings > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-900/40 text-yellow-400 border border-yellow-800/50">
                        경고 {r.summary.warnings}
                      </span>
                    )}
                    {r.summary.infos > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-900/40 text-blue-400 border border-blue-800/50">
                        정보 {r.summary.infos}
                      </span>
                    )}
                    {r.summary.fixable > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-900/40 text-green-400 border border-green-800/50">
                        수정 {r.summary.fixable}
                      </span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* 이슈 없음 */}
        {scanSummary && totalIssues === 0 && !scanning && (
          <div className="text-center py-8 text-gray-500 text-sm">
            ✓ 이슈가 발견되지 않았습니다
          </div>
        )}

        {/* ────── 의존성 분석 섹션 ────── */}
        {scanSummary && !scanning && (
          <div className="space-y-3 border-t border-gray-700 pt-5">
            <div className="flex items-center gap-3">
              <Package size={16} className="text-orange-400" />
              <span className="text-sm font-medium text-gray-200">의존성 분석</span>
              {!depStore.isLoading && depStore.summary && (
                <span className="text-xs text-gray-500">
                  {depStore.summary.total}개 패키지
                </span>
              )}
              <button
                onClick={runDepAnalysis}
                disabled={depStore.isLoading}
                className="ml-auto px-3 py-1.5 rounded bg-orange-700 hover:bg-orange-600 text-white text-xs flex items-center gap-1.5 disabled:opacity-50 transition-colors"
              >
                {depStore.isLoading
                  ? <><Loader2 size={12} className="animate-spin" /> 분석 중...</>
                  : <><ShieldAlert size={12} /> {depStore.summary ? '재분석' : '분석'}</>
                }
              </button>
            </div>

            {depStore.error && (
              <div className="flex items-center gap-2 text-xs text-red-400">
                <AlertCircle size={12} /> {depStore.error}
              </div>
            )}

            {/* 의존성 요약 카드 */}
            {depStore.summary && (
              <div className="flex items-center gap-4 px-4 py-3 rounded border border-gray-700 bg-gray-800/50 text-sm">
                <span className="text-red-400">🔴 위험 {depStore.summary.danger}</span>
                <span className="text-yellow-400">🟠 경고 {depStore.summary.warning}</span>
                <span className="text-blue-400">🔵 검토 {depStore.summary.review}</span>
                <span className="text-green-400">🟢 정상 {depStore.summary.safe}</span>
              </div>
            )}

            {/* 위험/경고 패키지 리스트 */}
            {depStore.summary && riskyDepCount > 0 && (
              <div className="space-y-2">
                <button
                  onClick={() => setDepExpanded(!depExpanded)}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-300"
                >
                  {depExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  위험 패키지 {riskyDepCount}개 {depExpanded ? '접기' : '펼치기'}
                </button>

                {depExpanded && (
                  <div className="rounded border border-gray-700 bg-gray-800/30 divide-y divide-gray-700/50 max-h-[300px] overflow-y-auto custom-scrollbar">
                    {depStore.dependencies
                      .filter((d) => d.riskLevel === 'danger' || d.riskLevel === 'warning')
                      .map((d) => (
                        <DepRow key={d.name} dep={d} />
                      ))
                    }
                  </div>
                )}

                {/* AI 의존성 분석 */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={runDepAI}
                    disabled={depAIStreaming}
                    className="px-3 py-1.5 rounded bg-purple-700 hover:bg-purple-600 text-white text-xs flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                  >
                    {depAIStreaming
                      ? <><Loader2 size={12} className="animate-spin" /> 분석 중...</>
                      : <><Bot size={12} /> AI 호환성 분석 ({riskyDepCount}개)</>
                    }
                  </button>
                  {depAIDone && (
                    <span className="text-[10px] text-green-400">✓ 완료</span>
                  )}
                </div>

                {/* AI 응답 */}
                {(depAIStreaming || depAIText) && (
                  <div className="rounded border border-gray-700 bg-gray-800/40 p-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                    <div
                      className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{
                        __html: depAIText
                          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                          .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-gray-700 text-gray-200 text-[11px]">$1</code>')
                          .replace(/\*\*(.+?)\*\*/g, '<strong class="text-gray-100 font-semibold">$1</strong>')
                          .replace(/^### (.+)$/gm, '<div class="text-xs font-semibold text-gray-200 mt-2 mb-1">$1</div>')
                          .replace(/^## (.+)$/gm, '<div class="text-sm font-bold text-gray-200 mt-3 mb-1">$1</div>')
                          .replace(/^[-*] (.+)$/gm, '<div class="ml-3 text-gray-300">\u2022 $1</div>')
                          .replace(/\n\n/g, '<br/>')
                          .replace(/\n/g, '<br/>'),
                      }}
                    />
                    {depAIStreaming && <span className="animate-pulse text-purple-400">▌</span>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 작업 시작 버튼 */}
        {scanSummary && !scanning && (
          <div className="flex justify-end pt-2">
            <button
              onClick={handleStart}
              className="px-5 py-2.5 rounded bg-blue-700 hover:bg-blue-600 text-white text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Play size={14} />
              작업 시작
              {selected.size > 0 && (
                <span className="text-blue-200/80 text-xs">({selected.size}건)</span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** 의존성 행 컴포넌트 */
function DepRow({ dep }: { dep: DepInfo }) {
  const riskColors: Record<string, string> = {
    danger: 'bg-red-900/40 text-red-400 border-red-800/50',
    warning: 'bg-yellow-900/40 text-yellow-400 border-yellow-800/50',
  };
  return (
    <div className="flex items-center gap-3 px-3 py-2 text-xs">
      <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${riskColors[dep.riskLevel] ?? ''}`}>
        {dep.riskLevel === 'danger' ? '위험' : '경고'}
      </span>
      <span className="text-gray-200 font-mono font-medium min-w-[120px]">{dep.name}</span>
      <span className="text-gray-500">{dep.currentVersion}</span>
      {dep.latestVersion && (
        <span className="text-gray-600">→ {dep.latestVersion}</span>
      )}
      {dep.cveCount > 0 && (
        <span className="text-red-400 text-[10px]">CVE {dep.cveCount}</span>
      )}
      {dep.hasNativeAddon && (
        <span className="text-orange-400 text-[10px]">native</span>
      )}
      <span className="text-gray-500 truncate flex-1 text-right">{dep.riskReason}</span>
    </div>
  );
}
