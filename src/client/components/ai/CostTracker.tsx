import { Coins } from 'lucide-react';
import type { AITokenUsage } from '@shared/types/ai';

interface CostTrackerProps {
  usage: AITokenUsage;
}

/** 누적 토큰 사용량 및 비용 표시 배지 */
export function CostTracker({ usage }: CostTrackerProps) {
  if (usage.inputTokens === 0 && usage.outputTokens === 0) return null;

  const totalTokens = usage.inputTokens + usage.outputTokens;

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded bg-gray-700/50 text-xs text-gray-400 transition-colors hover:bg-gray-700"
      title={`입력: ${usage.inputTokens.toLocaleString()} / 출력: ${usage.outputTokens.toLocaleString()} 토큰`}
    >
      <Coins size={12} className="text-yellow-500 shrink-0" />
      <span>{totalTokens.toLocaleString()} 토큰</span>
      <span className="text-yellow-500 font-medium">${usage.estimatedCostUSD.toFixed(4)}</span>
    </div>
  );
}
