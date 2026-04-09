import { useEffect } from 'react';
import { Loader2, RefreshCw, Search } from 'lucide-react';
import { useAnalysisStore } from '../../stores/useAnalysisStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { AnalysisSummary } from './AnalysisSummary';
import { RuleMatchCard } from './RuleMatchCard';
import { ANALYZABLE_EXTENSIONS } from '@shared/constants';

interface AnalysisPanelProps {
  filePath: string;
  onClickLine?: (line: number) => void;
}

/** 파일 분석 결과 패널 — 에디터 우측 또는 하단에 배치 */
export function AnalysisPanel({ filePath, onClickLine }: AnalysisPanelProps) {
  const { results, analyzingFile, error, analyzeFile } = useAnalysisStore();
  const targetNodeVersion = useSettingsStore((s) => s.targetNodeVersion);
  const currentNodeVersion = useProjectStore((s) => s.projectInfo?.nodeVersion ?? null);

  const result = results[filePath] ?? null;
  const isAnalyzing = analyzingFile === filePath;

  // 파일 확장자 체크
  const ext = '.' + filePath.split('.').pop();
  const isAnalyzable = ANALYZABLE_EXTENSIONS.includes(ext);

  // 파일 열릴 때 자동 분석
  useEffect(() => {
    if (filePath && isAnalyzable && !result && !isAnalyzing) {
      analyzeFile(filePath, targetNodeVersion, currentNodeVersion ?? undefined);
    }
  }, [filePath]);

  if (!isAnalyzable) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        이 파일 유형은 분석 대상이 아닙니다
      </div>
    );
  }

  if (isAnalyzing) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
        <Loader2 size={24} className="animate-spin" />
        <span className="text-sm">분석 중...</span>
      </div>
    );
  }

  if (error && !result) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-red-400 text-sm p-4">
        <p>분석 실패: {error}</p>
        <button
          onClick={() => analyzeFile(filePath, targetNodeVersion, currentNodeVersion ?? undefined)}
          className="flex items-center gap-1 px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors"
        >
          <RefreshCw size={12} /> 재시도
        </button>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-500">
        <Search size={24} />
        <button
          onClick={() => analyzeFile(filePath, targetNodeVersion, currentNodeVersion ?? undefined)}
          className="flex items-center gap-1 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm transition-colors"
        >
          <Search size={14} /> 분석 실행
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-800/50">
        <span className="text-xs text-gray-400 font-medium">분석 결과</span>
        <button
          onClick={() => analyzeFile(filePath, targetNodeVersion, currentNodeVersion ?? undefined)}
          className="text-gray-500 hover:text-gray-300 transition-colors"
          title="재분석"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {/* 요약 */}
      <div className="p-2">
        <AnalysisSummary result={result} />
      </div>

      {/* 이슈 목록 */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
        {result.matches.map((match, i) => (
          <RuleMatchCard key={`${match.ruleId}-${match.line}-${i}`} match={match} onClickLine={onClickLine} />
        ))}
      </div>

      {/* 자동 수정 가능 시 버튼 */}
      {result.fixedContent && (
        <div className="px-3 py-2 border-t border-gray-700 bg-gray-800/50">
          <FixButton filePath={filePath} fixedContent={result.fixedContent} />
        </div>
      )}
    </div>
  );
}

function FixButton({ filePath, fixedContent }: { filePath: string; fixedContent: string }) {
  const handleApplyFix = () => {
    useEditorStore.getState().setSuggestedContent(filePath, fixedContent);
  };

  return (
    <button
      onClick={handleApplyFix}
      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-green-700 hover:bg-green-600 text-white text-sm transition-colors"
    >
      자동 수정 프리뷰 보기
    </button>
  );
}
