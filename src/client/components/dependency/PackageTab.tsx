import { useEffect, useRef } from 'react';
import { RefreshCw, Package, AlertCircle, AlertTriangle, Search, CheckCircle2 } from 'lucide-react';
import { useDependencyStore } from '../../stores/useDependencyStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { RiskTable } from './RiskTable';
import { Spinner } from '../shared/Spinner';

export function PackageTab() {
  const { dependencies, summary, isLoading, error, analyze } = useDependencyStore();
  const targetNodeVersion = useSettingsStore((s) => s.targetNodeVersion);
  const initialized = useRef(false);

  // 첫 마운트 시 자동 분석
  useEffect(() => {
    if (!initialized.current && dependencies.length === 0) {
      initialized.current = true;
      analyze(targetNodeVersion);
    }
  }, [analyze, dependencies.length, targetNodeVersion]);

  const handleRefresh = () => {
    analyze(targetNodeVersion);
  };

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
        <Spinner size="lg" />
        <span className="text-sm">의존성을 분석하고 있습니다...</span>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <AlertCircle size={32} className="text-red-400" />
        <p className="text-sm text-red-400">{error}</p>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-200 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
        >
          <RefreshCw size={12} />
          다시 시도
        </button>
      </div>
    );
  }

  // 분석 결과 없음
  if (dependencies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
        <Package size={32} />
        <p className="text-sm">분석된 의존성이 없습니다.</p>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-200 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
        >
          <RefreshCw size={12} />
          분석 시작
        </button>
      </div>
    );
  }

  const dangerCount = summary?.danger ?? 0;
  const warningCount = summary?.warning ?? 0;
  const reviewCount = summary?.review ?? 0;
  const safeCount = summary?.safe ?? 0;
  const totalCount = dependencies.length;

  return (
    <div className="flex flex-col h-full">
      {/* 요약 카드 + 새로고침 */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-700 bg-gray-800/50">
        {/* 전체 */}
        <SummaryCard
          label="전체"
          count={totalCount}
          icon={<Package size={14} />}
          color="text-gray-300"
          bgColor="bg-gray-600/20"
        />
        {/* 위험 */}
        <SummaryCard
          label="위험"
          count={dangerCount}
          icon={<AlertCircle size={14} />}
          color="text-red-400"
          bgColor="bg-red-600/20"
        />
        {/* 경고 */}
        <SummaryCard
          label="경고"
          count={warningCount}
          icon={<AlertTriangle size={14} />}
          color="text-amber-400"
          bgColor="bg-amber-600/20"
        />
        {/* 검토 */}
        <SummaryCard
          label="검토"
          count={reviewCount}
          icon={<Search size={14} />}
          color="text-yellow-400"
          bgColor="bg-yellow-600/20"
        />
        {/* 정상 */}
        <SummaryCard
          label="정상"
          count={safeCount}
          icon={<CheckCircle2 size={14} />}
          color="text-green-400"
          bgColor="bg-green-600/20"
        />

        {/* 새로고침 버튼 */}
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
          새로고침
        </button>
      </div>

      {/* 위험도 테이블 */}
      <div className="flex-1 overflow-hidden">
        <RiskTable />
      </div>
    </div>
  );
}

/** 요약 카드 */
function SummaryCard({
  label,
  count,
  icon,
  color,
  bgColor,
}: {
  label: string;
  count: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded ${bgColor}`}>
      <span className={color}>{icon}</span>
      <span className="text-xs text-gray-400">{label}</span>
      <span className={`text-sm font-semibold ${color}`}>{count}</span>
    </div>
  );
}
