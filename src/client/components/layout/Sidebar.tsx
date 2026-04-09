import { FileTree } from '../file-tree/FileTree';
import { useUIStore } from '../../stores/useUIStore';
import { FolderTree } from 'lucide-react';

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const activePage = useUIStore((s) => s.activePage);

  // 에디터 페이지에서만 사이드바 표시
  if (!sidebarOpen || activePage !== 'editor') return null;

  return (
    <aside className="w-[280px] bg-[rgb(22,27,34)] border-r border-gray-700 flex flex-col shrink-0 h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700">
        <FolderTree size={14} className="text-gray-500" />
        <span className="text-xs font-medium text-gray-400">파일 탐색기</span>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <FileTree />
      </div>
    </aside>
  );
}
