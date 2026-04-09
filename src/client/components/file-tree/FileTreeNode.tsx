import { useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-react';
import type { TreeNode } from '@shared/types/project';
import { useEditorStore } from '../../stores/useEditorStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { getFileColor } from '../../utils/fileIcons';

interface FileTreeNodeProps {
  node: TreeNode;
  depth: number;
}

export function FileTreeNodeComponent({ node, depth }: FileTreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 1);
  const [children, setChildren] = useState<TreeNode[] | undefined>(node.children);
  const [loading, setLoading] = useState(false);
  const openFile = useEditorStore((s) => s.openFile);
  const activeTabPath = useEditorStore((s) => s.activeTabPath);
  const refreshTree = useProjectStore((s) => s.refreshTree);

  const isDir = node.type === 'directory';
  const isActive = activeTabPath === node.path;

  const handleToggle = useCallback(async () => {
    if (!isDir) return;

    if (!expanded && (!children || children.length === 0)) {
      setLoading(true);
      try {
        const loaded = await refreshTree(node.path);
        setChildren(loaded);
      } finally {
        setLoading(false);
      }
    }
    setExpanded((e) => !e);
  }, [isDir, expanded, children, node.path, refreshTree]);

  const handleClick = useCallback(() => {
    if (isDir) {
      handleToggle();
    } else {
      openFile(node.path);
    }
  }, [isDir, handleToggle, openFile, node.path]);

  const paddingLeft = 12 + depth * 16;

  return (
    <div>
      <button
        onClick={handleClick}
        className={`
          w-full flex items-center gap-1.5 py-[3px] pr-2 text-left text-sm
          transition-colors duration-75 group
          ${isActive ? 'bg-blue-600/20 text-blue-300' : 'text-gray-300 hover:bg-gray-700/50'}
        `}
        style={{ paddingLeft }}
      >
        {/* 확장 화살표 */}
        <span className="w-4 h-4 flex items-center justify-center shrink-0">
          {isDir ? (
            expanded ? (
              <ChevronDown size={14} className="text-gray-500" />
            ) : (
              <ChevronRight size={14} className="text-gray-500" />
            )
          ) : null}
        </span>

        {/* 아이콘 */}
        <span className="shrink-0">
          {isDir ? (
            expanded ? (
              <FolderOpen size={15} className="text-blue-400" />
            ) : (
              <Folder size={15} className="text-blue-400" />
            )
          ) : (
            <File size={14} className={getFileColor(node.extension)} />
          )}
        </span>

        {/* 파일명 */}
        <span className="truncate">{node.name}</span>

        {/* 로딩 */}
        {loading && (
          <span className="ml-auto text-xs text-gray-600 animate-pulse">...</span>
        )}
      </button>

      {/* 자식 노드 */}
      {isDir && expanded && children && (
        <div>
          {children.map((child) => (
            <FileTreeNodeComponent
              key={child.path}
              node={child}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
