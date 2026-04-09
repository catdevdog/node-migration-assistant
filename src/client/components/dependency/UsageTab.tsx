import { useState, useMemo } from 'react';
import {
  Package,
  FileCode,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Search,
  Loader2,
  GitFork,
  ExternalLink,
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { useEditorStore } from '../../stores/useEditorStore';
import { useUIStore } from '../../stores/useUIStore';
import type { ImportGraph } from '@shared/types/dependency';

export function UsageTab() {
  const [graph, setGraph] = useState<ImportGraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPkgs, setExpandedPkgs] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<string>('');

  const openFile = useEditorStore((s) => s.openFile);
  const setActivePage = useUIStore((s) => s.setActivePage);

  /** 파일을 에디터에서 열기 */
  const handleOpenFile = (filePath: string) => {
    openFile(filePath);
    setActivePage('editor');
  };

  /** Import 그래프 분석 실행 */
  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.post<ImportGraph>('/deps/graph');
      setGraph(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : '사용처 분석에 실패했습니다.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  /** 패키지 접기/펼치기 토글 */
  const togglePkg = (pkgName: string) => {
    setExpandedPkgs((prev) => {
      const next = new Set(prev);
      if (next.has(pkgName)) {
        next.delete(pkgName);
      } else {
        next.add(pkgName);
      }
      return next;
    });
  };

  /** 사용 횟수 기준 정렬된 패키지 목록 */
  const sortedPackages = useMemo(() => {
    if (!graph) return [];
    return Object.entries(graph.packageUsage)
      .sort(([, a], [, b]) => b.importCount - a.importCount);
  }, [graph]);

  /** 역방향 import에 사용할 파일 목록 */
  const localFiles = useMemo(() => {
    if (!graph) return [];
    return graph.files.map((f) => f.filePath).sort();
  }, [graph]);

  /** 선택한 파일을 import하는 파일 목록 */
  const reverseFiles = useMemo(() => {
    if (!graph || !selectedFile) return [];
    return graph.reverseImports[selectedFile] ?? [];
  }, [graph, selectedFile]);

  // 초기 상태 (분석 전)
  if (!graph && !loading && !error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
        <GitFork size={32} />
        <p className="text-sm">파일 간 import 관계와 패키지 사용처를 분석합니다.</p>
        <button
          onClick={handleAnalyze}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-gray-200 bg-blue-600 rounded hover:bg-blue-500 transition-colors"
        >
          <Search size={14} />
          분석
        </button>
      </div>
    );
  }

  // 로딩 상태
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
        <Loader2 size={32} className="animate-spin" />
        <span className="text-sm">사용처를 분석하고 있습니다...</span>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Package size={32} className="text-red-400" />
        <p className="text-sm text-red-400">{error}</p>
        <button
          onClick={handleAnalyze}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-200 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 헤더 - 새로고침 버튼 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800/50">
        <span className="text-xs text-gray-400">
          <Package size={12} className="inline mr-1" />
          {sortedPackages.length}개 패키지 / {localFiles.length}개 파일
        </span>
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50 transition-colors"
        >
          <Search size={12} />
          다시 분석
        </button>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar p-4 space-y-6">
        {/* 섹션 1: 외부 패키지 사용처 */}
        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-200 mb-3">
            <Package size={16} className="text-blue-400" />
            외부 패키지 사용처
          </h3>

          {sortedPackages.length === 0 ? (
            <p className="text-xs text-gray-500 pl-6">외부 패키지 사용이 감지되지 않았습니다.</p>
          ) : (
            <div className="space-y-1">
              {sortedPackages.map(([pkgName, usage]) => {
                const isExpanded = expandedPkgs.has(pkgName);
                return (
                  <div key={pkgName} className="border border-gray-700 rounded">
                    {/* 패키지 헤더 */}
                    <button
                      onClick={() => togglePkg(pkgName)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-800/50 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown size={14} className="text-gray-500 flex-shrink-0" />
                      ) : (
                        <ChevronRight size={14} className="text-gray-500 flex-shrink-0" />
                      )}
                      <Package size={14} className="text-purple-400 flex-shrink-0" />
                      <span className="text-xs font-medium text-gray-200">{pkgName}</span>
                      <span className="text-xs text-gray-500 ml-auto">
                        {usage.importCount}파일
                      </span>
                    </button>

                    {/* 사용 파일 목록 */}
                    {isExpanded && (
                      <div className="border-t border-gray-700 bg-gray-900/30">
                        {usage.files.map((filePath) => {
                          // 해당 파일에서 이 패키지를 import하는 라인 찾기
                          const fileInfo = graph?.files.find((f) => f.filePath === filePath);
                          const importLine = fileInfo?.imports.find(
                            (imp) => imp.packageName === pkgName || imp.source === pkgName,
                          );
                          const lineNum = importLine?.line;

                          return (
                            <div
                              key={filePath}
                              className="flex items-center gap-2 px-3 py-1.5 pl-10 hover:bg-gray-800/30 transition-colors group"
                            >
                              <FileCode size={12} className="text-gray-500 flex-shrink-0" />
                              <span className="text-xs text-gray-400 truncate flex-1">
                                {filePath}
                                {lineNum != null && (
                                  <span className="text-gray-600">:{lineNum}</span>
                                )}
                              </span>
                              <button
                                onClick={() => handleOpenFile(filePath)}
                                className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-0.5 text-[10px] text-blue-400 hover:text-blue-300 bg-gray-700 rounded transition-all"
                              >
                                <ExternalLink size={10} />
                                열기
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 섹션 2: 파일 영향 분석 */}
        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-200 mb-3">
            <GitFork size={16} className="text-green-400" />
            파일 영향 분석
          </h3>

          {/* 파일 선택 드롭다운 */}
          <div className="mb-3">
            <select
              value={selectedFile}
              onChange={(e) => setSelectedFile(e.target.value)}
              className="w-full max-w-md px-3 py-2 text-xs bg-gray-800 border border-gray-600 rounded text-gray-200 focus:outline-none focus:border-blue-500"
            >
              <option value="">파일을 선택하세요...</option>
              {localFiles.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          {/* 선택된 파일의 역방향 import 결과 */}
          {selectedFile && (
            <div className="border border-gray-700 rounded p-3">
              <p className="text-xs text-gray-400 mb-2">
                <span className="text-blue-400 font-medium">{selectedFile}</span>
                을 수정하면 영향받는 파일:
              </p>

              {reverseFiles.length === 0 ? (
                <p className="text-xs text-gray-500 pl-4">
                  이 파일을 import하는 파일이 없습니다.
                </p>
              ) : (
                <div className="space-y-1">
                  {reverseFiles.map((importerPath) => {
                    // import 상세 정보 찾기
                    const importerInfo = graph?.files.find((f) => f.filePath === importerPath);
                    const relevantImport = importerInfo?.imports.find(
                      (imp) => imp.resolvedPath === selectedFile || imp.source.includes(selectedFile),
                    );

                    return (
                      <div
                        key={importerPath}
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-800/30 rounded transition-colors group"
                      >
                        <ArrowRight size={12} className="text-green-500 flex-shrink-0" />
                        <FileCode size={12} className="text-gray-500 flex-shrink-0" />
                        <span className="text-xs text-gray-300 truncate flex-1">
                          {importerPath}
                          {relevantImport && (
                            <span className="text-gray-500 ml-1">
                              (import {'{'} {relevantImport.source} {'}'})
                            </span>
                          )}
                        </span>
                        <button
                          onClick={() => handleOpenFile(importerPath)}
                          className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-0.5 text-[10px] text-blue-400 hover:text-blue-300 bg-gray-700 rounded transition-all"
                        >
                          <ExternalLink size={10} />
                          열기
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {!selectedFile && (
            <p className="text-xs text-gray-500 pl-4">
              파일을 선택하면 해당 파일에 의존하는 다른 파일들을 확인할 수 있습니다.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
