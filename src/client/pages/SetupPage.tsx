import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  GitBranch,
  Loader2,
  Package,
  Play,
  Search,
  ShieldAlert,
  Sparkles,
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
import type { RuleMatch } from '@shared/types/rule';

/** AI 가이드 분석 결과를 FileAnalysisResult 포맷으로 변환 */
function makeGuideResult(filePath: string, matches: RuleMatch[]): FileAnalysisResult {
  return {
    filePath,
    matches,
    fixedContent: undefined,
    duration: 0,
    summary: {
      total: matches.length,
      fixable: 0,
      needsAI: matches.length,
      errors: matches.filter((m) => m.severity === 'error').length,
      warnings: matches.filter((m) => m.severity === 'warning').length,
      infos: matches.filter((m) => m.severity === 'info').length,
    },
  };
}

export function SetupPage() {
  const projectInfo = useProjectStore((s) => s.projectInfo);
  const targetNodeVersion = useSettingsStore((s) => s.targetNodeVersion);
  const scopePatterns = useSettingsStore((s) => s.scopePatterns);
  const setScopePatterns = useSettingsStore((s) => s.setScopePatterns);
  const migrationGuide = useSettingsStore((s) => s.migrationGuide);
  const setMigrationGuide = useSettingsStore((s) => s.setMigrationGuide);
  const setActivePage = useUIStore((s) => s.setActivePage);

  // 스캔 범위 입력
  const [inputValue, setInputValue] = useState(scopePatterns);

  // 스캔 상태
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [scanResults, setScanResults] = useState<FileAnalysisResult[]>([]);
  const [scanSummary, setScanSummary] = useState<ProjectScanSummary | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // 파일 목록 보기 모드: 'issue' = 이슈 파일만, 'all' = 전체 스캔 파일
  const [fileViewMode, setFileViewMode] = useState<'issue' | 'all'>('issue');
  // 전체 파일 검색어
  const [fileSearch, setFileSearch] = useState('');

  // AI 가이드 분석 상태
  const [guideAnalyzing, setGuideAnalyzing] = useState(false);
  const [guideProgress, setGuideProgress] = useState({ current: 0, total: 0, file: '' });
  const [guideMatchMap, setGuideMatchMap] = useState<Map<string, RuleMatch[]>>(new Map());
  const guideAbortRef = useRef<AbortController | null>(null);

  // 파일 선택 상태
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // 의존성 분석
  const depStore = useDependencyStore();
  const [depExpanded, setDepExpanded] = useState(false);
  const [depAIText, setDepAIText] = useState('');
  const [depAIStreaming, setDepAIStreaming] = useState(false);
  const [depAIDone, setDepAIDone] = useState(false);
  const depAIRef = useRef<AbortController | null>(null);

  /** 의존성 분석 */
  const runDepAnalysis = () => void depStore.analyze(targetNodeVersion);

  /** 위험 의존성 AI 분석 */
  const runDepAI = () => {
    const risky = depStore.dependencies.filter(
      (d) => d.riskLevel === 'danger' || d.riskLevel === 'warning',
    );
    if (!risky.length) return;
    setDepAIText('');
    setDepAIStreaming(true);
    setDepAIDone(false);
    depAIRef.current = streamAIRequest('dependency', {
      packages: risky.map((d) => ({
        name: d.name, currentVersion: d.currentVersion, latestVersion: d.latestVersion,
        enginesNode: d.enginesNode, riskLevel: d.riskLevel, riskReason: d.riskReason,
        cveCount: d.cveCount, hasNativeAddon: d.hasNativeAddon,
      })),
      currentNodeVersion: projectInfo?.currentNodeVersion,
      targetNodeVersion,
    }, {
      onChunk: (t) => setDepAIText((p) => p + t),
      onDone: () => { setDepAIStreaming(false); setDepAIDone(true); },
      onError: (msg) => { setDepAIText(`❌ ${msg}`); setDepAIStreaming(false); },
    });
  };

  /** scanResults + guideMatchMap 병합 → 이슈 파일 목록 */
  const issueFiles = useMemo(() => {
    const map = new Map<string, FileAnalysisResult>();
    for (const r of scanResults) map.set(r.filePath, r);

    for (const [fp, gm] of guideMatchMap) {
      const ex = map.get(fp);
      if (ex) {
        const combined = [...ex.matches, ...gm];
        map.set(fp, {
          ...ex,
          matches: combined,
          summary: {
            total: combined.length,
            fixable: combined.filter((m) => m.fixable).length,
            needsAI: combined.filter((m) => m.needsAI).length,
            errors: combined.filter((m) => m.severity === 'error').length,
            warnings: combined.filter((m) => m.severity === 'warning').length,
            infos: combined.filter((m) => m.severity === 'info').length,
          },
        });
      } else if (gm.length > 0) {
        map.set(fp, makeGuideResult(fp, gm));
      }
    }

    return Array.from(map.values())
      .filter((r) => r.summary.total > 0)
      .sort((a, b) =>
        (b.summary.errors * 100 + b.summary.warnings * 10 + b.summary.infos) -
        (a.summary.errors * 100 + a.summary.warnings * 10 + a.summary.infos),
      );
  }, [scanResults, guideMatchMap]);

  /** 현재 뷰에 표시할 파일 목록 */
  const displayFiles = useMemo(() => {
    if (fileViewMode === 'issue') return issueFiles;
    // 전체 파일 — 검색어로 필터
    const base = scanResults
      .filter((r) => !fileSearch || r.filePath.toLowerCase().includes(fileSearch.toLowerCase()))
      .slice(0, 300); // 최대 300개
    // 이슈 파일은 이슈 수 정보를 병합
    return base.map((r) => issueFiles.find((i) => i.filePath === r.filePath) ?? r);
  }, [fileViewMode, issueFiles, scanResults, fileSearch]);

  /** 스캔 완료 시 에러/경고 파일 자동 선택 — guideMatchMap 변경 시엔 선택 유지 */
  useEffect(() => {
    const auto = new Set<string>();
    for (const r of issueFiles) {
      if (r.summary.errors > 0 || r.summary.warnings > 0) auto.add(r.filePath);
    }
    setSelected(auto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanResults]); // scanResults만 의존 — guideMatchMap 변경 시 선택 유지

  const toggleFile = (path: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });

  const toggleAll = () =>
    setSelected(
      selected.size === displayFiles.length
        ? new Set()
        : new Set(displayFiles.map((r) => r.filePath)),
    );

  /** SSE 스캔 */
  const runScopeScan = async (patterns: string) => {
    if (!projectInfo) return;
    setScanning(true);
    setScanError(null);
    setScanResults([]);
    setScanSummary(null);
    setScanProgress({ current: 0, total: 0 });
    setGuideMatchMap(new Map()); // 재스캔 시 AI 결과 초기화
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
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() ?? '';
        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(part.slice(6));
            if (data.type === 'progress') setScanProgress({ current: data.current, total: data.total });
            else if (data.type === 'done') { setScanResults(data.results ?? []); setScanSummary(data.summary ?? null); }
          } catch { /* 무시 */ }
        }
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : '스캔 실패');
    } finally {
      setScanning(false);
    }
  };

  /** AI 가이드 분석 — 선택된 파일 or 전체 이슈 파일 or 스캔 파일(최대 30개) */
  const runGuideAnalysis = async () => {
    if (!projectInfo || !migrationGuide.trim()) return;

    // 선택된 것 → 전체 이슈 파일 → 스캔 파일 중 최대 30개
    const selectedPaths = displayFiles
      .filter((r) => selected.has(r.filePath))
      .map((r) => r.filePath);
    const targets = selectedPaths.length > 0
      ? selectedPaths
      : issueFiles.length > 0
        ? issueFiles.map((r) => r.filePath)
        : scanResults.slice(0, 30).map((r) => r.filePath);

    if (!targets.length) return;

    setGuideAnalyzing(true);
    setGuideProgress({ current: 0, total: targets.length, file: '' });
    const ctrl = new AbortController();
    guideAbortRef.current = ctrl;

    try {
      const res = await fetch('/api/ai/guide-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': useSettingsStore.getState().apiKey ?? '',
        },
        body: JSON.stringify({
          filePaths: targets,
          migrationGuide,
          currentNodeVersion: projectInfo.currentNodeVersion,
          targetNodeVersion,
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`가이드 분석 실패: ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() ?? '';
        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(part.slice(6));
            if (data.type === 'progress') {
              setGuideProgress({ current: data.current, total: data.total, file: data.filePath });
            } else if (data.type === 'file-done') {
              const matches: RuleMatch[] = data.matches ?? [];
              setGuideMatchMap((prev) => {
                const next = new Map(prev);
                next.set(data.filePath, [...(next.get(data.filePath) ?? []), ...matches]);
                return next;
              });
            }
          } catch { /* 무시 */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') console.error('가이드 분석 오류:', err);
    } finally {
      setGuideAnalyzing(false);
    }
  };

  useEffect(() => {
    if (projectInfo) void runScopeScan(scopePatterns);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectInfo?.projectPath, targetNodeVersion]);

  const handleScan = () => void runScopeScan(inputValue);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleScan(); }
  };

  /** 작업 시작 */
  const handleStart = async () => {
    const queue = useQueueStore.getState();
    queue.reset();
    const items: QueueItem[] = issueFiles
      .filter((r) => selected.has(r.filePath))
      .map((r) => ({
        filePath: r.filePath,
        riskLevel: r.summary.errors > 0 ? 'high' : r.summary.warnings > 0 ? 'medium' : 'low',
        source: 'preflight',
        status: 'pending',
        issueCount: r.summary.total,
      } as QueueItem));

    if (items.length > 0) {
      queue.addItems(items);
      const first = useQueueStore.getState().items[useQueueStore.getState().activeIndex];
      if (first) await useEditorStore.getState().openFile(first.filePath);
    }
    setActivePage('work');
  };

  const riskyDepCount = depStore.dependencies.filter(
    (d) => d.riskLevel === 'danger' || d.riskLevel === 'warning',
  ).length;

  const gitDirty = projectInfo?.gitStatus?.hasUncommittedChanges;
  const autoFixCount = issueFiles.reduce((s, r) => s + r.summary.fixable, 0);
  const aiCount = issueFiles.reduce((s, r) => s + r.summary.needsAI, 0);

  if (!projectInfo) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <Loader2 size={24} className="animate-spin mb-3" />
        <p className="text-sm">프로젝트 로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-gray-900">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-5">

        {/* ── 프로젝트 요약 ── */}
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

        {/* ── 작업 범위 스캔 ── */}
        <div className="space-y-2">
          <label className="text-xs text-gray-400">작업 범위 (glob 패턴, 쉼표 구분)</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="예: src/auth, src/api (비우면 전체)"
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

        {/* ── 마이그레이션 가이드 (항상 표시) ── */}
        <div className="space-y-2 rounded border border-purple-800/40 bg-purple-950/20 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-purple-300">마이그레이션 가이드</span>
            <span className="text-[10px] text-gray-500">AI 분석 시 기준으로 사용</span>
          </div>
          <textarea
            value={migrationGuide}
            onChange={(e) => setMigrationGuide(e.target.value)}
            placeholder={`주요 변경 사항을 자유롭게 적으세요.\n예:\n- React Router v5 → v6: <Switch>→<Routes>, component → element prop\n- moment.js → dayjs 교체\n- class 컴포넌트 → 함수형 + Hooks\n- axios 0.x → 1.x breaking changes`}
            rows={5}
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500 resize-y font-mono leading-relaxed"
          />
          {/* AI 가이드 분석 버튼 — 가이드가 있어야 활성화 */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-600">
              {selected.size > 0
                ? `선택된 ${selected.size}개 파일 분석`
                : issueFiles.length > 0
                  ? `이슈 파일 ${issueFiles.length}개 분석`
                  : scanResults.length > 0
                    ? `스캔 파일 중 최대 30개 분석`
                    : '스캔 후 사용 가능'}
            </span>
            <button
              onClick={() => { void runGuideAnalysis(); }}
              disabled={guideAnalyzing || !migrationGuide.trim() || scanResults.length === 0}
              className="px-3 py-1.5 rounded bg-purple-700 hover:bg-purple-600 text-white text-xs flex items-center gap-1.5 disabled:opacity-40 transition-colors"
            >
              {guideAnalyzing
                ? <><Loader2 size={12} className="animate-spin" /> {guideProgress.current}/{guideProgress.total} 분석 중</>
                : <><Sparkles size={12} /> AI 가이드 분석</>
              }
            </button>
          </div>
          {guideAnalyzing && guideProgress.file && (
            <div className="text-[11px] text-purple-400 truncate">
              → {guideProgress.file}
            </div>
          )}
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

        {/* 스캔 결과 요약 */}
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

        {/* ── 파일 목록 ── */}
        {scanSummary && !scanning && (
          <div className="space-y-2">
            {/* 보기 모드 탭 + 전체선택 */}
            <div className="flex items-center gap-2">
              {/* 탭 */}
              <div className="flex rounded overflow-hidden border border-gray-700 text-xs">
                <button
                  onClick={() => setFileViewMode('issue')}
                  className={`px-3 py-1.5 transition-colors ${
                    fileViewMode === 'issue'
                      ? 'bg-gray-700 text-white'
                      : 'bg-gray-800/50 text-gray-500 hover:text-gray-300'
                  }`}
                >
                  이슈 파일 ({issueFiles.length})
                </button>
                <button
                  onClick={() => { setFileViewMode('all'); }}
                  className={`px-3 py-1.5 transition-colors border-l border-gray-700 ${
                    fileViewMode === 'all'
                      ? 'bg-gray-700 text-white'
                      : 'bg-gray-800/50 text-gray-500 hover:text-gray-300'
                  }`}
                >
                  전체 파일 ({scanResults.length})
                </button>
              </div>

              {/* 전체 선택 */}
              <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none ml-2">
                <input
                  type="checkbox"
                  checked={displayFiles.length > 0 && selected.size === displayFiles.length}
                  onChange={toggleAll}
                  className="accent-blue-500 w-3.5 h-3.5"
                />
                전체 선택
              </label>
              <span className="text-xs text-gray-600">({selected.size}개 선택)</span>
            </div>

            {/* 전체 파일 검색 */}
            {fileViewMode === 'all' && (
              <input
                type="text"
                value={fileSearch}
                onChange={(e) => setFileSearch(e.target.value)}
                placeholder="파일 경로 검색..."
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
            )}

            {/* 파일 리스트 */}
            {displayFiles.length > 0 ? (
              <div className="rounded border border-gray-700 bg-gray-800/30 divide-y divide-gray-700/50 max-h-[400px] overflow-y-auto custom-scrollbar">
                {displayFiles.map((r) => (
                  <label
                    key={r.filePath}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-gray-800/60 cursor-pointer"
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
                    <div className="flex items-center gap-1 shrink-0">
                      {guideMatchMap.has(r.filePath) && (
                        <span className="px-1 py-0.5 rounded text-[10px] bg-purple-900/40 text-purple-300 border border-purple-700/50">
                          ✨AI
                        </span>
                      )}
                      {r.summary.errors > 0 && (
                        <span className="px-1 py-0.5 rounded text-[10px] bg-red-900/40 text-red-400 border border-red-800/50">
                          오류 {r.summary.errors}
                        </span>
                      )}
                      {r.summary.warnings > 0 && (
                        <span className="px-1 py-0.5 rounded text-[10px] bg-yellow-900/40 text-yellow-400 border border-yellow-800/50">
                          경고 {r.summary.warnings}
                        </span>
                      )}
                      {r.summary.infos > 0 && (
                        <span className="px-1 py-0.5 rounded text-[10px] bg-blue-900/40 text-blue-400 border border-blue-800/50">
                          정보 {r.summary.infos}
                        </span>
                      )}
                      {r.summary.fixable > 0 && (
                        <span className="px-1 py-0.5 rounded text-[10px] bg-green-900/40 text-green-400 border border-green-800/50">
                          수정 {r.summary.fixable}
                        </span>
                      )}
                    </div>
                  </label>
                ))}
                {fileViewMode === 'all' && scanResults.length > 300 && (
                  <div className="text-center py-2 text-xs text-gray-600">
                    {scanResults.length - 300}개 더 있음 — 검색으로 좁히세요
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 space-y-2">
                <p className="text-gray-500 text-sm">
                  {fileViewMode === 'issue' ? '✓ 규칙 기반 이슈 없음' : '파일 없음'}
                </p>
                {fileViewMode === 'issue' && !migrationGuide.trim() && (
                  <p className="text-xs text-gray-600">
                    마이그레이션 가이드를 작성하고 AI 가이드 분석을 실행해보세요.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── 의존성 분석 ── */}
        {scanSummary && !scanning && (
          <div className="space-y-3 border-t border-gray-700 pt-5">
            <div className="flex items-center gap-3">
              <Package size={16} className="text-orange-400" />
              <span className="text-sm font-medium text-gray-200">의존성 분석</span>
              {depStore.summary && (
                <span className="text-xs text-gray-500">{depStore.summary.total}개 패키지</span>
              )}
              <button
                onClick={runDepAnalysis}
                disabled={depStore.isLoading}
                className="ml-auto px-3 py-1.5 rounded bg-orange-700 hover:bg-orange-600 text-white text-xs flex items-center gap-1.5 disabled:opacity-50 transition-colors"
              >
                {depStore.isLoading
                  ? <><Loader2 size={12} className="animate-spin" /> 분석 중...</>
                  : <><ShieldAlert size={12} /> {depStore.summary ? '재분석' : '분석'}</>}
              </button>
            </div>

            {depStore.error && (
              <div className="text-xs text-red-400 flex items-center gap-2">
                <AlertCircle size={12} /> {depStore.error}
              </div>
            )}

            {depStore.summary && (
              <div className="flex items-center gap-4 px-4 py-3 rounded border border-gray-700 bg-gray-800/50 text-sm">
                <span className="text-red-400">🔴 위험 {depStore.summary.danger}</span>
                <span className="text-yellow-400">🟠 경고 {depStore.summary.warning}</span>
                <span className="text-blue-400">🔵 검토 {depStore.summary.review}</span>
                <span className="text-green-400">🟢 정상 {depStore.summary.safe}</span>
              </div>
            )}

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
                      .map((d) => <DepRow key={d.name} dep={d} />)}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={runDepAI}
                    disabled={depAIStreaming}
                    className="px-3 py-1.5 rounded bg-purple-700 hover:bg-purple-600 text-white text-xs flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                  >
                    {depAIStreaming
                      ? <><Loader2 size={12} className="animate-spin" /> 분석 중...</>
                      : <><Bot size={12} /> AI 호환성 분석 ({riskyDepCount}개)</>}
                  </button>
                  {depAIDone && <span className="text-[10px] text-green-400">✓ 완료</span>}
                </div>

                {(depAIStreaming || depAIText) && (
                  <div className="rounded border border-gray-700 bg-gray-800/40 p-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                    <div
                      className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{
                        __html: depAIText
                          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                          .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-gray-700 text-gray-200 text-[11px]">$1</code>')
                          .replace(/\*\*(.+?)\*\*/g, '<strong class="text-gray-100">$1</strong>')
                          .replace(/^### (.+)$/gm, '<div class="text-xs font-semibold text-gray-200 mt-2 mb-1">$1</div>')
                          .replace(/^## (.+)$/gm, '<div class="text-sm font-bold text-gray-200 mt-3 mb-1">$1</div>')
                          .replace(/^[-*] (.+)$/gm, '<div class="ml-3 text-gray-300">• $1</div>')
                          .replace(/\n\n/g, '<br/>').replace(/\n/g, '<br/>'),
                      }}
                    />
                    {depAIStreaming && <span className="animate-pulse text-purple-400">▌</span>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 작업 시작 */}
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

function DepRow({ dep }: { dep: DepInfo }) {
  const colors: Record<string, string> = {
    danger: 'bg-red-900/40 text-red-400 border-red-800/50',
    warning: 'bg-yellow-900/40 text-yellow-400 border-yellow-800/50',
  };
  return (
    <div className="flex items-center gap-3 px-3 py-2 text-xs">
      <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${colors[dep.riskLevel] ?? ''}`}>
        {dep.riskLevel === 'danger' ? '위험' : '경고'}
      </span>
      <span className="text-gray-200 font-mono font-medium min-w-[120px]">{dep.name}</span>
      <span className="text-gray-500">{dep.currentVersion}</span>
      {dep.latestVersion && <span className="text-gray-600">→ {dep.latestVersion}</span>}
      {dep.cveCount > 0 && <span className="text-red-400 text-[10px]">CVE {dep.cveCount}</span>}
      {dep.hasNativeAddon && <span className="text-orange-400 text-[10px]">native</span>}
      <span className="text-gray-500 truncate flex-1 text-right">{dep.riskReason}</span>
    </div>
  );
}
