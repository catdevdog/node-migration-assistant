import { BarChart3 } from 'lucide-react';

/** Phase 7에서 완전 구현 — 현재는 플레이스홀더 */
export function DashboardPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-500">
      <BarChart3 size={48} className="mb-4 text-gray-600" />
      <p className="text-lg font-medium text-gray-400">대시보드</p>
      <p className="text-sm mt-1">마이그레이션 진행 현황이 여기에 표시됩니다.</p>
      <p className="text-xs mt-2 text-gray-600">(Phase 7에서 구현 예정)</p>
    </div>
  );
}
