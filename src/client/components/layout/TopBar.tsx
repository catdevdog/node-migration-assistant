import { useState, useRef, useEffect } from 'react';
import {
  Settings,
  ClipboardList,
  Hammer,
  Pencil,
} from 'lucide-react';
import { useUIStore, type ActivePage } from '../../stores/useUIStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { SUPPORTED_NODE_VERSIONS, ALL_NODE_VERSIONS } from '@shared/constants';

const NAV_ITEMS: { page: ActivePage; label: string; icon: typeof Hammer }[] = [
  { page: 'setup', label: '준비', icon: ClipboardList },
  { page: 'work', label: '작업', icon: Hammer },
];

export function TopBar() {
  const { activePage, setActivePage } = useUIStore();
  const projectInfo = useProjectStore((s) => s.projectInfo);
  const setCurrentNodeVersion = useProjectStore((s) => s.setCurrentNodeVersion);
  const { targetNodeVersion, setTargetNodeVersion } = useSettingsStore();

  // 현재 Node 버전 인라인 편집 상태
  const [editingCurrent, setEditingCurrent] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const currentVersion = projectInfo?.currentNodeVersion ?? null;

  const startEdit = () => {
    setEditValue(currentVersion ?? '');
    setEditingCurrent(true);
  };

  const commitEdit = () => {
    const v = editValue.trim().replace(/^v/i, '');
    if (v && /^\d+/.test(v)) {
      setCurrentNodeVersion(v);
    }
    setEditingCurrent(false);
  };

  useEffect(() => {
    if (editingCurrent) inputRef.current?.focus();
  }, [editingCurrent]);

  return (
    <header className="h-10 bg-gray-800 border-b border-gray-700 flex items-center px-3 gap-3 shrink-0">
      {/* 프로젝트 이름 */}
      {projectInfo && (
        <span className="text-sm font-medium text-gray-300 truncate max-w-[180px]">
          {projectInfo.projectName}
        </span>
      )}

      {/* 버전 */}
      {projectInfo && (
        <div className="flex items-center gap-1 text-xs text-gray-500">
          {/* 현재 버전 — 클릭해서 편집 */}
          {editingCurrent ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') setEditingCurrent(false);
              }}
              placeholder="예: 12"
              className="w-12 bg-gray-700 border border-blue-500 rounded px-1 py-0.5 text-xs text-gray-200 focus:outline-none"
            />
          ) : (
            <button
              onClick={startEdit}
              title="클릭하여 현재 Node 버전 수동 지정"
              className={`flex items-center gap-0.5 hover:text-gray-300 group ${
                !currentVersion ? 'text-yellow-500' : ''
              }`}
            >
              <span>Node {currentVersion ?? '? (클릭하여 지정)'}</span>
              <Pencil size={10} className="opacity-0 group-hover:opacity-60 transition-opacity" />
            </button>
          )}

          <span className="text-gray-600">→</span>

          {/* 목표 버전 선택 */}
          <select
            value={targetNodeVersion}
            onChange={(e) => setTargetNodeVersion(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
          >
            {SUPPORTED_NODE_VERSIONS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 2탭 네비 */}
      <nav className="flex items-center gap-1 ml-auto">
        {NAV_ITEMS.map(({ page, label, icon: Icon }) => (
          <button
            key={page}
            onClick={() => setActivePage(page)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors
              ${activePage === page
                ? 'bg-gray-700 text-white'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/50'
              }
            `}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}

        {/* 설정 아이콘 */}
        <button
          onClick={() => {
            // 간단한 API 키 설정만 — 모달로 처리
            useUIStore.getState().openModal('apiKey');
          }}
          className="ml-1 p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-700/50 rounded transition-colors"
          title="설정"
        >
          <Settings size={14} />
        </button>
      </nav>
    </header>
  );
}
