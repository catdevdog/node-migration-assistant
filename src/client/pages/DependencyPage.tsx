import { Package } from 'lucide-react';

/** Phase 2에서 완전 구현 — 현재는 플레이스홀더 */
export function DependencyPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-500">
      <Package size={48} className="mb-4 text-gray-600" />
      <p className="text-lg font-medium text-gray-400">의존성 분석</p>
      <p className="text-sm mt-1">패키지 위험도 분석 결과가 여기에 표시됩니다.</p>
      <p className="text-xs mt-2 text-gray-600">(Phase 2에서 구현 예정)</p>
    </div>
  );
}
