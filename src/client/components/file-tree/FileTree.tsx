import { useProjectStore } from '../../stores/useProjectStore';
import { FileTreeNodeComponent } from './FileTreeNode';
import { Spinner } from '../shared/Spinner';

export function FileTree() {
  const { fileTree, isLoading, error } = useProjectStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="sm" />
        <span className="ml-2 text-xs text-gray-500">프로젝트 스캔 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-4 text-xs text-red-400">
        <p className="font-medium">로드 실패</p>
        <p className="mt-1 text-gray-500">{error}</p>
      </div>
    );
  }

  if (fileTree.length === 0) {
    return (
      <div className="px-3 py-4 text-xs text-gray-500">
        파일이 없습니다.
      </div>
    );
  }

  return (
    <div className="py-1">
      {fileTree.map((node) => (
        <FileTreeNodeComponent key={node.path} node={node} depth={0} />
      ))}
    </div>
  );
}
