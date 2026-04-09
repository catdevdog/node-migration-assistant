import { useProjectStore } from '../../stores/useProjectStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { useSettingsStore } from '../../stores/useSettingsStore';

export function StatusBar() {
  const projectInfo = useProjectStore((s) => s.projectInfo);
  const activeTabPath = useEditorStore((s) => s.activeTabPath);
  const apiKey = useSettingsStore((s) => s.apiKey);

  return (
    <footer className="h-7 bg-gray-800 border-t border-gray-700 flex items-center px-3 text-xs text-gray-500 shrink-0">
      {/* 왼쪽: 현재 파일 */}
      <div className="flex items-center gap-3">
        {activeTabPath && (
          <span className="truncate max-w-[300px]">{activeTabPath}</span>
        )}
      </div>

      {/* 오른쪽 */}
      <div className="flex items-center gap-3 ml-auto">
        {/* AI 연결 상태 */}
        <span className="flex items-center gap-1">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              apiKey ? 'bg-green-400' : 'bg-gray-600'
            }`}
          />
          {apiKey ? 'AI 연결됨' : 'AI 미연결'}
        </span>

        {/* 프로젝트 정보 */}
        {projectInfo && (
          <>
            <span>{projectInfo.detectedFramework}</span>
            <span>Node {projectInfo.currentNodeVersion ?? '?'} → {projectInfo.targetNodeVersion}</span>
          </>
        )}
      </div>
    </footer>
  );
}
