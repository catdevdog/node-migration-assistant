import { useEffect } from 'react';
import { Package, RefreshCw, Shield, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';
import { useDependencyStore } from '../stores/useDependencyStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { RiskTable } from '../components/dependency/RiskTable';
import { Button } from '../components/shared/Button';
import { Spinner } from '../components/shared/Spinner';

export function DependencyPage() {
  const { summary, isLoading, error, analyze, dependencies } = useDependencyStore();
  const targetNodeVersion = useSettingsStore((s) => s.targetNodeVersion);

  const handleAnalyze = () => {
    analyze(targetNodeVersion);
  };

  // 첫 진입 시 자동 분석
  useEffect(() => {
    if (dependencies.length === 0 && !isLoading) {
      handleAnalyze();
    }
  }, []);

  // 아직 분석 전
  if (dependencies.length === 0 && !isLoading && !error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <Package size={48} className="mb-4 text-gray-600" />
        <p className="text-lg font-medium text-gray-400">의존성 분석</p>
        <p className="text-sm mt-2 mb-4">프로젝트의 의존성을 분석하여 위험도를 평가합니다.</p>
        <Button onClick={handleAnalyze} icon={<RefreshCw size={14} />}>
          분석 시작
        </Button>
      </div>
    );
  }

  // 로딩 중
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <Spinner size="lg" />
        <p className="text-sm mt-4">의존성 분석 중...</p>
        <p className="text-xs mt-1 text-gray-600">npm registry 조회 + npm audit 실행 중</p>
      </div>
    );
  }

  // 에러
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <AlertCircle size={48} className="mb-4 text-red-400" />
        <p className="text-lg font-medium text-red-400">분석 실패</p>
        <p className="text-sm mt-1 text-gray-400">{error}</p>
        <Button onClick={handleAnalyze} variant="secondary" className="mt-4">
          다시 시도
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 상단 요약 카드 */}
      {summary && (
        <div className="grid grid-cols-5 gap-3 p-4 border-b border-gray-700">
          <SummaryCard
            label="전체"
            count={summary.total}
            icon={<Package size={16} />}
            color="text-gray-300"
            bgColor="bg-gray-700/30"
          />
          <SummaryCard
            label="위험"
            count={summary.danger}
            icon={<AlertCircle size={16} />}
            color="text-red-400"
            bgColor="bg-red-500/10"
          />
          <SummaryCard
            label="경고"
            count={summary.warning}
            icon={<AlertTriangle size={16} />}
            color="text-amber-400"
            bgColor="bg-amber-500/10"
          />
          <SummaryCard
            label="검토"
            count={summary.review}
            icon={<Shield size={16} />}
            color="text-yellow-400"
            bgColor="bg-yellow-500/10"
          />
          <SummaryCard
            label="정상"
            count={summary.safe}
            icon={<CheckCircle size={16} />}
            color="text-green-400"
            bgColor="bg-green-500/10"
          />
        </div>
      )}

      {/* 도구 바 */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-gray-300">의존성 위험도 테이블</h2>
        <span className="text-xs text-gray-500">목표: Node {targetNodeVersion}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAnalyze}
          loading={isLoading}
          icon={<RefreshCw size={12} />}
          className="ml-auto"
        >
          새로고침
        </Button>
      </div>

      {/* 위험도 테이블 */}
      <div className="flex-1 overflow-hidden">
        <RiskTable />
      </div>
    </div>
  );
}

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
    <div className={`rounded-lg p-3 ${bgColor}`}>
      <div className={`flex items-center gap-1.5 text-xs ${color} mb-1`}>
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-bold ${color}`}>{count}</div>
    </div>
  );
}
