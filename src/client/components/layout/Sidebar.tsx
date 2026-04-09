import { useUIStore } from '../../stores/useUIStore';
import { FileTree } from '../file-tree/FileTree';

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);

  if (!sidebarOpen) return null;

  return (
    <aside className="w-[280px] min-w-[200px] bg-gray-850 border-r border-gray-700 flex flex-col shrink-0 overflow-hidden"
      style={{ backgroundColor: 'rgb(22, 27, 34)' }}
    >
      {/* 헤더 */}
      <div className="px-3 py-2 border-b border-gray-700">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          파일 탐색기
        </h3>
      </div>

      {/* 파일 트리 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <FileTree />
      </div>
    </aside>
  );
}
