import { AlertTriangle, AlertCircle, Info, Wrench, Bot } from 'lucide-react';
import type { RuleMatch } from '@shared/types/rule';

const severityConfig = {
  error: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-900/20', border: 'border-red-800/50', label: '오류' },
  warning: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-900/20', border: 'border-yellow-800/50', label: '경고' },
  info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-900/20', border: 'border-blue-800/50', label: '정보' },
};

interface RuleMatchCardProps {
  match: RuleMatch;
  onClickLine?: (line: number) => void;
}

export function RuleMatchCard({ match, onClickLine }: RuleMatchCardProps) {
  const config = severityConfig[match.severity];
  const Icon = config.icon;

  return (
    <div className={`rounded-md border ${config.border} ${config.bg} p-3 text-sm`}>
      {/* 헤더 */}
      <div className="flex items-start gap-2">
        <Icon size={16} className={`${config.color} mt-0.5 shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-medium ${config.color}`}>{match.ruleName}</span>
            <button
              onClick={() => onClickLine?.(match.line)}
              className="text-xs text-gray-500 hover:text-gray-300 font-mono transition-colors"
            >
              L{match.line}:{match.column}
            </button>
          </div>
          <p className="text-gray-300 mt-1">{match.message}</p>
        </div>
      </div>

      {/* 태그 */}
      <div className="flex items-center gap-2 mt-2 ml-6">
        {match.fixable && (
          <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-green-900/30 text-green-400 border border-green-800/50">
            <Wrench size={10} /> 자동 수정
          </span>
        )}
        {match.needsAI && (
          <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-400 border border-purple-800/50">
            <Bot size={10} /> AI 검토
          </span>
        )}
        {match.suggestedFix && (
          <span className="text-xs text-gray-500 font-mono truncate">
            → {match.suggestedFix}
          </span>
        )}
      </div>

      {/* AI 이유 */}
      {match.aiReason && (
        <p className="text-xs text-gray-500 mt-1.5 ml-6 italic">
          {match.aiReason}
        </p>
      )}
    </div>
  );
}
