import { AlertCircle, AlertTriangle, Info, Wrench, Bot, Clock } from 'lucide-react';
import type { FileAnalysisResult } from '@shared/types/analysis';

interface AnalysisSummaryProps {
  result: FileAnalysisResult;
}

export function AnalysisSummary({ result }: AnalysisSummaryProps) {
  const { summary, duration } = result;

  if (summary.total === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-green-900/20 border border-green-800/50 text-green-400 text-sm">
        <span>✓</span>
        <span>이슈가 발견되지 않았습니다</span>
        <span className="text-xs text-gray-500 ml-auto flex items-center gap-1">
          <Clock size={10} /> {duration}ms
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 flex-wrap px-3 py-2 rounded-md bg-gray-800/50 border border-gray-700 text-sm">
      <span className="text-gray-400 font-medium">
        {summary.total}개 이슈
      </span>
      <div className="flex items-center gap-3 text-xs">
        {summary.errors > 0 && (
          <span className="flex items-center gap-1 text-red-400">
            <AlertCircle size={12} /> {summary.errors} 오류
          </span>
        )}
        {summary.warnings > 0 && (
          <span className="flex items-center gap-1 text-yellow-400">
            <AlertTriangle size={12} /> {summary.warnings} 경고
          </span>
        )}
        {summary.infos > 0 && (
          <span className="flex items-center gap-1 text-blue-400">
            <Info size={12} /> {summary.infos} 정보
          </span>
        )}
        {summary.fixable > 0 && (
          <span className="flex items-center gap-1 text-green-400">
            <Wrench size={12} /> {summary.fixable} 자동수정
          </span>
        )}
        {summary.needsAI > 0 && (
          <span className="flex items-center gap-1 text-purple-400">
            <Bot size={12} /> {summary.needsAI} AI필요
          </span>
        )}
      </div>
      <span className="text-xs text-gray-500 ml-auto flex items-center gap-1">
        <Clock size={10} /> {duration}ms
      </span>
    </div>
  );
}
