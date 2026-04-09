import { FolderTree, Package, BookOpen, Settings } from 'lucide-react';
import { useUIStore, type ActivePage } from '../../stores/useUIStore';
import { FileTree } from '../file-tree/FileTree';

const navItems: { page: ActivePage; label: string; icon: React.ElementType }[] = [
  { page: 'editor', label: '파일 탐색기', icon: FolderTree },
  { page: 'dependencies', label: '의존성 분석', icon: Package },
  { page: 'guide', label: '마이그레이션 가이드', icon: BookOpen },
  { page: 'settings', label: '설정', icon: Settings },
];

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const activePage = useUIStore((s) => s.activePage);

  if (!sidebarOpen) return null;

  return (
    <aside className="w-[280px] min-w-[200px] bg-gray-850 border-r border-gray-700 flex flex-col shrink-0 overflow-hidden"
      style={{ backgroundColor: 'rgb(22, 27, 34)' }}
    >
      {/* 네비게이션 */}
      <nav className="px-2 py-2 border-b border-gray-700 space-y-0.5">
        {navItems.map(({ page, label, icon: Icon }) => (
          <button
            key={page}
            onClick={() => useUIStore.getState().setActivePage(page)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
              activePage === page
                ? 'bg-blue-600/20 text-blue-400'
                : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </nav>

      {/* 파일 트리 (에디터 페이지일 때만 표시) */}
      {activePage === 'editor' && (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <FileTree />
        </div>
      )}
    </aside>
  );
}
