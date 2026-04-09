import {
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  Package,
  FileCode,
  Settings,
} from 'lucide-react';
import { useUIStore, type ActivePage } from '../../stores/useUIStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { SUPPORTED_NODE_VERSIONS, NODE_VERSION_INFO } from '@shared/constants';
import { Badge } from '../shared/Badge';

const NAV_ITEMS: { page: ActivePage; label: string; icon: typeof FileCode }[] = [
  { page: 'editor', label: '에디터', icon: FileCode },
  { page: 'dependencies', label: '의존성', icon: Package },
  { page: 'dashboard', label: '대시보드', icon: LayoutDashboard },
  { page: 'settings', label: '설정', icon: Settings },
];

export function TopBar() {
  const { sidebarOpen, toggleSidebar, activePage, setActivePage } = useUIStore();
  const projectInfo = useProjectStore((s) => s.projectInfo);
  const { targetNodeVersion, setTargetNodeVersion } = useSettingsStore();

  return (
    <header className="h-12 bg-gray-800 border-b border-gray-700 flex items-center px-3 gap-3 shrink-0">
      {/* 사이드바 토글 */}
      <button
        onClick={toggleSidebar}
        className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
        title={sidebarOpen ? '사이드바 닫기' : '사이드바 열기'}
      >
        {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
      </button>

      {/* 프로젝트 이름 */}
      {projectInfo && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-200 truncate max-w-[200px]">
            {projectInfo.projectName}
          </span>
          <Badge variant="info">{projectInfo.detectedFramework}</Badge>
        </div>
      )}

      {/* 버전 선택 */}
      {projectInfo && (
        <div className="flex items-center gap-1.5 ml-2 text-xs text-gray-400">
          <span>
            Node {projectInfo.currentNodeVersion ?? '?'}
            {projectInfo.currentNodeVersion && NODE_VERSION_INFO[projectInfo.currentNodeVersion.split('.')[0]]?.isEOL && (
              <span className="ml-1 text-yellow-400" title="EOL 버전">⚠</span>
            )}
          </span>
          <span className="text-gray-600">→</span>
          <select
            value={targetNodeVersion}
            onChange={(e) => setTargetNodeVersion(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
          >
            {SUPPORTED_NODE_VERSIONS.map((v) => (
              <option key={v} value={v}>
                Node {v} LTS
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 네비게이션 */}
      <nav className="flex items-center gap-1 ml-auto">
        {NAV_ITEMS.map(({ page, label, icon: Icon }) => (
          <button
            key={page}
            onClick={() => setActivePage(page)}
            className={`
              flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors
              ${activePage === page
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
              }
            `}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
}
