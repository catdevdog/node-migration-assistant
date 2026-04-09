import { ArrowUpDown, Search, ExternalLink } from 'lucide-react';
import { useDependencyStore } from '../../stores/useDependencyStore';
import { Badge } from '../shared/Badge';
import { RISK_LABELS } from '@shared/constants';
import type { DepSortField, DepFilterLevel } from '@shared/types/dependency';
import type { RiskLevel } from '@shared/constants';

const RISK_BADGE_MAP: Record<RiskLevel, 'danger' | 'warning' | 'review' | 'safe'> = {
  danger: 'danger',
  warning: 'warning',
  review: 'review',
  safe: 'safe',
};

const FILTER_OPTIONS: Array<{ value: DepFilterLevel; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'danger', label: '🔴 위험' },
  { value: 'warning', label: '🟠 경고' },
  { value: 'review', label: '🟡 검토' },
  { value: 'safe', label: '🟢 정상' },
];

const COLUMNS: Array<{ field: DepSortField; label: string; className: string }> = [
  { field: 'name', label: '패키지명', className: 'text-left min-w-[200px]' },
  { field: 'currentVersion', label: '현재 버전', className: 'text-left w-[120px]' },
  { field: 'riskLevel', label: '위험 등급', className: 'text-center w-[100px]' },
  { field: 'cveCount', label: 'CVE', className: 'text-center w-[60px]' },
];

export function RiskTable() {
  const {
    sortField,
    sortDirection,
    filterLevel,
    searchQuery,
    setSort,
    setFilter,
    setSearch,
    getFilteredDeps,
  } = useDependencyStore();

  const filteredDeps = getFilteredDeps();

  return (
    <div className="flex flex-col h-full">
      {/* 필터 바 */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-700">
        {/* 검색 */}
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="패키지 검색..."
            className="w-full pl-8 pr-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* 위험 등급 필터 */}
        <div className="flex items-center gap-1">
          {FILTER_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                filterLevel === value
                  ? 'bg-gray-600 text-white'
                  : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 건수 */}
        <span className="text-xs text-gray-500 ml-auto">
          {filteredDeps.length}개 패키지
        </span>
      </div>

      {/* 테이블 */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-800 border-b border-gray-700">
            <tr>
              {COLUMNS.map(({ field, label, className }) => (
                <th
                  key={field}
                  className={`px-4 py-2 font-medium text-gray-400 cursor-pointer hover:text-gray-200 select-none ${className}`}
                  onClick={() => setSort(field)}
                >
                  <span className="inline-flex items-center gap-1">
                    {label}
                    {sortField === field && (
                      <ArrowUpDown
                        size={12}
                        className={`text-blue-400 ${sortDirection === 'desc' ? 'rotate-180' : ''}`}
                      />
                    )}
                  </span>
                </th>
              ))}
              <th className="px-4 py-2 text-left font-medium text-gray-400 min-w-[120px]">
                최신 버전
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-400 min-w-[250px]">
                권장 조치
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredDeps.map((dep) => (
              <tr
                key={dep.name}
                className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
              >
                {/* 패키지명 */}
                <td className="px-4 py-2">
                  <div className="flex items-center gap-1.5">
                    <a
                      href={`https://www.npmjs.com/package/${dep.name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 hover:underline font-medium"
                    >
                      {dep.name}
                    </a>
                    <ExternalLink size={10} className="text-gray-600" />
                    {dep.isDev && (
                      <Badge variant="info">dev</Badge>
                    )}
                  </div>
                </td>

                {/* 현재 버전 */}
                <td className="px-4 py-2 text-gray-300 font-mono">
                  {dep.currentVersion}
                </td>

                {/* 위험 등급 */}
                <td className="px-4 py-2 text-center">
                  <Badge variant={RISK_BADGE_MAP[dep.riskLevel]}>
                    {RISK_LABELS[dep.riskLevel]}
                  </Badge>
                </td>

                {/* CVE 건수 */}
                <td className="px-4 py-2 text-center">
                  {dep.cveCount > 0 ? (
                    <span className="text-red-400 font-semibold">{dep.cveCount}</span>
                  ) : (
                    <span className="text-gray-600">0</span>
                  )}
                </td>

                {/* 최신 버전 */}
                <td className="px-4 py-2 text-gray-400 font-mono">
                  {dep.latestVersion ?? '-'}
                </td>

                {/* 권장 조치 */}
                <td className="px-4 py-2 text-gray-400">
                  <span title={dep.riskReason}>{dep.recommendation}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredDeps.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            {searchQuery ? '검색 결과가 없습니다.' : '분석 결과가 없습니다.'}
          </div>
        )}
      </div>
    </div>
  );
}
