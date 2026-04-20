import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  Wrench,
  Sparkles,
  AlertTriangle,
  Replace,
  GitBranch,
  Loader2,
  Play,
  PackageX,
  Package as PackageIcon,
  CircleAlert,
} from 'lucide-react';
import { useProjectStore } from '../stores/useProjectStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useDependencyStore } from '../stores/useDependencyStore';
import { useUIStore } from '../stores/useUIStore';
import { useQueueStore, type QueueItem } from '../stores/useQueueStore';
import { useEditorStore } from '../stores/useEditorStore';
import type { FileAnalysisResult, ProjectScanSummary } from '@shared/types/analysis';
import { Button } from '../components/shared/Button';

/** 사전 분석 결과 통합 요약 */
interface PreflightSummary {
  scanSummary: ProjectScanSummary | null;
  needsAICount: number;          // 규칙으로 해결 안 되는 이슈 건수
  manualCount: number;           // 자동수정도 AI도 아닌 수동 검토 필요 건수
  replaceLibCount: number;       // 🔴 위험 등급의 의존성 수
}

/** 복잡도 등급 */
type ComplexityGrade = '소' | '중' | '대';

function calcComplexity(
  totalIssues: number,
  totalFiles: number,
  replaceLibCount: number,
): ComplexityGrade {
  // 가중치 — 라이브러리 교체는 1건당 5점, 이슈는 1건당 1점, 파일은 1개당 0.5점
  const score = totalIssues + replaceLibCount * 5 + totalFiles * 0.5;
  if (score <= 15) return '소';
  if (score <= 60) return '중';
  return '대';
}

/** 예상 AI 비용 (USD) — 매우 거친 추정값 */
function estimateAICost(needsAICount: number, replaceLibCount: number): number {
  // Sonnet 단가: $3/1M 입력, $15/1M 출력
  // needsAI 1건당 평균: 입력 4000 + 출력 4000 토큰
  // replaceLib 1건당 평균: 입력 2000 + 출력 3000 토큰
  const aiInput = needsAICount * 4000;
  const aiOutput = needsAICount * 4000;
  const libInput = replaceLibCount * 2000;
  const libOutput = replaceLibCount * 3000;
  const inputCost = ((aiInput + libInput) / 1_000_000) * 3;
  const outputCost = ((aiOutput + libOutput) / 1_000_000) * 15;
  return inputCost + outputCost;
}

export function DashboardPage() {
  const projectInfo = useProjectStore((s) => s.projectInfo);
  const targetNodeVersion = useSettingsStore((s) => s.targetNodeVersion);
  const apiKey = useSettingsStore((s) => s.apiKey);
  const setActivePage = useUIStore((s) => s.setActivePage);

  // 의존성 분석 — useDependencyStore 재사용
  const depAnalyze = useDependencyStore((s) => s.analyze);
  const dependencies = useDependencyStore((s) => s.dependencies);
  const depSummary = useDependencyStore((s) => s.summary);
  const depLoading = useDependencyStore((s) => s.isLoading);
  const depError = useDependencyStore((s) => s.error);

  // 파일 스캔 (SSE)
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [scanResults, setScanResults] = useState<FileAnalysisResult[]>([]);
  const [scanSummary, setScanSummary] = useState<ProjectScanSummary | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  /** 파일 스캔 SSE 실행 */
  const runFileScan = async () => {
    setScanning(true);
    setScanError(null);
    setScanResults([]);
    setScanSummary(null);
    setScanProgress({ current: 0, total: 0 });

    try {
      const res = await fetch('/api/file/analyze-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetNodeVersion,
          currentNodeVersion: projectInfo?.currentNodeVersion,
        }),
      });

      if (!res.ok) {
        throw new Error(`스캔 요청 실패: ${res.status}`);
      }

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
          } catch {
            /* JSON 파싱 실패 무시 */
          }
        }
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : '파일 스캔 실패');
    } finally {
      setScanning(false);
    }
  };

  /** 사전 분석 일괄 실행 — 프로젝트 로드 + apiKey 입력 후 자동 트리거 */
  useEffect(() => {
    if (!projectInfo) return;
    // 프로젝트 변경 시 기존 큐 초기화 (이전 작업의 잔재 방지)
    useQueueStore.getState().reset();
    // 의존성 + 파일 스캔 동시 시작
    void depAnalyze(targetNodeVersion);
    void runFileScan();
  }, [projectInfo?.projectPath, targetNodeVersion]);

  // 통합 요약 계산
  const summary = useMemo<PreflightSummary>(() => {
    const needsAICount = scanResults.reduce(
      (acc, r) => acc + (r.summary?.needsAI ?? 0),
      0,
    );
    const totalIssues = scanSummary?.totalIssues ?? 0;
    const totalFixable = scanSummary?.totalFixable ?? 0;
    const manualCount = Math.max(0, totalIssues - totalFixable - needsAICount);
    const replaceLibCount = depSummary?.danger ?? 0;
    return {
      scanSummary,
      needsAICount,
      manualCount,
      replaceLibCount,
    };
  }, [scanResults, scanSummary, depSummary]);

  const complexity = useMemo<ComplexityGrade>(() => {
    return calcComplexity(
      summary.scanSummary?.totalIssues ?? 0,
      summary.scanSummary?.analyzedFiles ?? 0,
      summary.replaceLibCount,
    );
  }, [summary]);

  const estimatedCost = useMemo(() => {
    return estimateAICost(summary.needsAICount, summary.replaceLibCount);
  }, [summary.needsAICount, summary.replaceLibCount]);

  const totalFixable = scanSummary?.totalFixable ?? 0;
  const totalNeedsAI = summary.needsAICount;
  const totalManual = summary.manualCount;
  const totalReplace = summary.replaceLibCount;

  /** 위험도 red/orange 파일만 큐에 투입 */
  const queueCandidates = useMemo<QueueItem[]>(() => {
    const items: QueueItem[] = [];
    for (const r of scanResults) {
      const errors = r.summary?.errors ?? 0;
      const warnings = r.summary?.warnings ?? 0;
      // red(high): error 1건이라도 있으면
      // orange(medium): error 0이고 warning 1건이라도 있으면
      // yellow/info만 있는 파일은 제외
      let risk: QueueItem['riskLevel'] | null = null;
      if (errors > 0) risk = 'high';
      else if (warnings > 0) risk = 'medium';
      if (!risk) continue;
      items.push({
        filePath: r.filePath,
        riskLevel: risk,
        source: 'preflight',
        status: 'pending',
        issueCount: r.summary?.total ?? 0,
      });
    }
    return items;
  }, [scanResults]);

  /** "작업 시작" — 큐에 자동 투입 후 에디터로 이동 */
  const handleStart = async () => {
    if (queueCandidates.length === 0) {
      // 큐에 넣을 파일이 없으면 그냥 에디터로 이동
      setActivePage('editor');
      return;
    }
    const queue = useQueueStore.getState();
    queue.reset();
    queue.addItems(queueCandidates);
    // 첫 항목 즉시 열기
    const first = useQueueStore.getState().items[useQueueStore.getState().activeIndex];
    if (first) {
      await useEditorStore.getState().openFile(first.filePath);
    }
    setActivePage('editor');
  };

  if (!projectInfo) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <LayoutDashboard size={48} className="mb-4 text-gray-600" />
        <p className="text-sm">프로젝트를 불러오는 중입니다...</p>
      </div>
    );
  }

  const showApiKeyHint = !apiKey;
  const gitDirty = projectInfo.gitStatus?.hasUncommittedChanges;
  const isLoadingAny = depLoading || scanning;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-gray-900">
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
              <LayoutDashboard size={20} className="text-blue-400" />
              사전 분석 리포트
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              마이그레이션 작업 착수 전 프로젝트 전체를 점검합니다.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={handleStart}
            disabled={isLoadingAny}
            title={
              queueCandidates.length > 0
                ? `위험도 🔴/🟠 파일 ${queueCandidates.length}건을 큐에 추가하고 에디터로 이동합니다.`
                : '큐에 추가할 위험 파일이 없습니다. 에디터로 이동합니다.'
            }
          >
            <Play size={14} className="mr-1.5" />
            작업 시작
            {queueCandidates.length > 0 && (
              <span className="ml-1.5 text-[10px] text-blue-100/80">
                ({queueCandidates.length}건)
              </span>
            )}
          </Button>
        </div>

        {/* git 경고 배너 */}
        {gitDirty && (
          <div className="flex items-start gap-3 px-4 py-3 rounded border border-yellow-700/60 bg-yellow-900/20">
            <GitBranch size={18} className="text-yellow-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-yellow-200 font-medium">
                커밋되지 않은 변경사항이 있습니다.
              </p>
              <p className="text-xs text-yellow-300/70 mt-0.5">
                현재 브랜치({projectInfo.gitStatus.currentBranch ?? '?'})에 작업 중인 변경사항이 있습니다.
                마이그레이션을 시작하기 전에 커밋 또는 stash를 권장합니다.
                node-migrator는 git을 직접 조작하지 않습니다.
              </p>
            </div>
          </div>
        )}

        {/* API 키 미설정 안내 */}
        {showApiKeyHint && (
          <div className="flex items-start gap-3 px-4 py-3 rounded border border-blue-700/60 bg-blue-900/20">
            <CircleAlert size={18} className="text-blue-300 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-200">
              API 키가 설정되지 않았습니다. 사전 분석은 가능하지만 AI 기반 수정은 사용할 수 없습니다.
            </p>
          </div>
        )}

        {/* 프로젝트 요약 */}
        <section className="rounded border border-gray-700 bg-gray-800/50 p-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase mb-3">
            프로젝트 요약
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-xs text-gray-500">이름</div>
              <div className="text-gray-200 truncate" title={projectInfo.projectName}>
                {projectInfo.projectName}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">현재 Node</div>
              <div className="text-gray-200">
                {projectInfo.currentNodeVersion ?? '알 수 없음'}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">목표 Node</div>
              <div className="text-gray-200">{targetNodeVersion} LTS</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">프레임워크</div>
              <div className="text-gray-200">{projectInfo.detectedFramework}</div>
            </div>
          </div>
        </section>

        {/* 이슈 요약 — 4개 카드 */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase mb-3">이슈 요약</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard
              icon={<Wrench size={18} className="text-green-400" />}
              label="자동수정 가능"
              value={totalFixable}
              loading={scanning}
              tone="green"
            />
            <SummaryCard
              icon={<Sparkles size={18} className="text-purple-400" />}
              label="AI 수정 필요"
              value={totalNeedsAI}
              loading={scanning}
              tone="purple"
            />
            <SummaryCard
              icon={<AlertTriangle size={18} className="text-yellow-400" />}
              label="수동 검토 필요"
              value={totalManual}
              loading={scanning}
              tone="yellow"
            />
            <SummaryCard
              icon={<Replace size={18} className="text-red-400" />}
              label="라이브러리 교체"
              value={totalReplace}
              loading={depLoading}
              tone="red"
              suffix="개"
            />
          </div>
          {scanning && (
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
              <Loader2 size={12} className="animate-spin" />
              파일 분석 중 ({scanProgress.current}/{scanProgress.total})
            </div>
          )}
          {scanError && (
            <p className="mt-2 text-xs text-red-400">{scanError}</p>
          )}
        </section>

        {/* 의존성 위험도 */}
        <section className="rounded border border-gray-700 bg-gray-800/50 p-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase mb-3">
            의존성 위험도
          </h2>
          {depLoading && !depSummary && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 size={12} className="animate-spin" />
              의존성 분석 중...
            </div>
          )}
          {depError && <p className="text-xs text-red-400">{depError}</p>}
          {depSummary && (
            <div className="grid grid-cols-4 gap-3">
              <RiskBadge color="red" label="위험" count={depSummary.danger} />
              <RiskBadge color="orange" label="경고" count={depSummary.warning} />
              <RiskBadge color="yellow" label="검토" count={depSummary.review} />
              <RiskBadge color="green" label="정상" count={depSummary.safe} />
            </div>
          )}
        </section>

        {/* 복잡도 등급 + 예상 비용 */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded border border-gray-700 bg-gray-800/50 p-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase mb-2">
              작업 복잡도
            </h2>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-3xl font-bold ${
                  complexity === '소'
                    ? 'text-green-400'
                    : complexity === '중'
                    ? 'text-yellow-400'
                    : 'text-red-400'
                }`}
              >
                {complexity}
              </span>
              <span className="text-xs text-gray-500">
                ({summary.scanSummary?.totalIssues ?? 0}건 / {summary.scanSummary?.analyzedFiles ?? 0}파일)
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              이슈 건수 + 파일 수 + 라이브러리 교체 가중치 기반의 단순 등급입니다.
              실제 작업 시간은 코드 복잡도, 테스트 커버리지, 도메인 지식에 따라 크게 달라질 수 있습니다.
            </p>
          </div>

          <div className="rounded border border-gray-700 bg-gray-800/50 p-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase mb-2">
              예상 AI 비용
            </h2>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-blue-400">
                ${estimatedCost.toFixed(2)}
              </span>
              <span className="text-xs text-gray-500">USD</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Claude Sonnet 단가($3/$15 per 1M)와 평균 응답 길이(약 4K 토큰)를 가정한 추정값입니다.
              실 사용량은 코드 길이와 재시도에 따라 변동됩니다.
            </p>
          </div>
        </section>

        {/* 상세 보기 진입점 */}
        <section className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setActivePage('dependencies')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded transition-colors"
          >
            <PackageIcon size={12} />
            의존성 상세 보기
          </button>
          <button
            onClick={() => setActivePage('editor')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded transition-colors"
          >
            <PackageX size={12} />
            에디터로 이동
          </button>
        </section>
      </div>
    </div>
  );
}

/** 카드 컴포넌트 */
function SummaryCard({
  icon,
  label,
  value,
  loading,
  tone,
  suffix,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  loading: boolean;
  tone: 'green' | 'purple' | 'yellow' | 'red';
  suffix?: string;
}) {
  const borderClass = {
    green: 'border-green-700/40',
    purple: 'border-purple-700/40',
    yellow: 'border-yellow-700/40',
    red: 'border-red-700/40',
  }[tone];

  return (
    <div
      className={`rounded border ${borderClass} bg-gray-800/50 p-4 flex flex-col gap-2`}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        {loading ? (
          <Loader2 size={18} className="animate-spin text-gray-500" />
        ) : (
          <>
            <span className="text-2xl font-bold text-gray-100">{value}</span>
            <span className="text-xs text-gray-500">{suffix ?? '건'}</span>
          </>
        )}
      </div>
    </div>
  );
}

/** 위험도 뱃지 */
function RiskBadge({
  color,
  label,
  count,
}: {
  color: 'red' | 'orange' | 'yellow' | 'green';
  label: string;
  count: number;
}) {
  const colorClass = {
    red: 'text-red-400 bg-red-500/10 border-red-700/40',
    orange: 'text-orange-400 bg-orange-500/10 border-orange-700/40',
    yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-700/40',
    green: 'text-green-400 bg-green-500/10 border-green-700/40',
  }[color];

  const dotColor = {
    red: 'bg-red-500',
    orange: 'bg-orange-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-500',
  }[color];

  return (
    <div className={`flex items-center justify-between rounded border px-3 py-2 ${colorClass}`}>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className="text-xs">{label}</span>
      </div>
      <span className="text-base font-semibold">{count}</span>
    </div>
  );
}
