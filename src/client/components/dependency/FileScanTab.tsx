import { useState, useCallback } from 'react';
import {
  FileSearch,
  Play,
  Loader2,
  FileCode,
  Wrench,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  ArrowUpDown,
} from 'lucide-react';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { useUIStore } from '../../stores/useUIStore';
import { apiClient } from '../../api/client';
import type { FileAnalysisResult, ProjectScanSummary } from '@shared/types/analysis';

/** 정렬 필드 */
type SortField = 'filePath' | 'total' | 'errors' | 'warnings' | 'fixable';
type SortDir = 'asc' | 'desc';

/** 스캔 진행률 */
interface ScanProgress {
  current: number;
  total: number;
  currentFile: string;
}

export function FileScanTab() {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress>({ current: 0, total: 0, currentFile: '' });
  const [results, setResults] = useState<FileAnalysisResult[]>([]);
  const [summary, setSummary] = useState<ProjectScanSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fixing, setFixing] = useState(false);

  // 정렬 상태
  const [sortField, setSortField] = useState<SortField>('errors');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  /** SSE 기반 전체 파일 스캔 */
  const scanAllFiles = useCallback(async () => {
    setScanning(true);
    setProgress({ current: 0, total: 0, currentFile: '' });
    setResults([]);
    setSummary(null);
    setError(null);

    const targetNodeVersion = useSettingsStore.getState().targetNodeVersion;
    const currentNodeVersion = useProjectStore.getState().projectInfo?.currentNodeVersion;

    try {
      const res = await fetch('/api/file/analyze-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetNodeVersion, currentNodeVersion }),
      });

      if (!res.ok) {
        throw new Error(`스캔 요청 실패: ${res.status} ${res.statusText}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'progress') {
              setProgress({
                current: data.current,
                total: data.total,
                currentFile: data.currentFile,
              });
            } else if (data.type === 'done') {
              setResults(data.results);
              setSummary(data.summary);
            }
          } catch {
            // JSON 파싱 실패 무시
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '스캔 중 오류 발생');
    } finally {
      setScanning(false);
    }
  }, []);

  /** 파일 열기 (에디터로 이동) */
  const handleOpenFile = useCallback(async (filePath: string) => {
    await useEditorStore.getState().openFile(filePath);
    useUIStore.getState().setActivePage('editor');
  }, []);

  /** 단일 파일 자동 수정 제안 — diff 뷰로 이동, 사용자가 승인해야 적용됨 */
  const handleFixFile = useCallback(async (result: FileAnalysisResult) => {
    if (!result.fixedContent) return;

    await useEditorStore.getState().openFile(result.filePath);
    useEditorStore.getState().setSuggestedContent(result.filePath, result.fixedContent);
    useUIStore.getState().setActivePage('editor');
  }, []);

  /** 전체 일괄 수정 */
  const handleFixAll = useCallback(async () => {
    const fixable = results.filter((r) => r.summary.fixable > 0 && r.fixedContent);
    if (fixable.length === 0) return;

    setFixing(true);
    try {
      for (const result of fixable) {
        await apiClient.post('/file/write', {
          filePath: result.filePath,
          content: result.fixedContent,
        });
      }
      // 수정 완료 후 재스캔
      await scanAllFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : '일괄 수정 중 오류 발생');
    } finally {
      setFixing(false);
    }
  }, [results, scanAllFiles]);

  /** 정렬 토글 */
  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('desc');
      return field;
    });
  }, []);

  /** 정렬된 결과 */
  const sortedResults = [...results].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'filePath':
        cmp = a.filePath.localeCompare(b.filePath);
        break;
      case 'total':
        cmp = a.summary.total - b.summary.total;
        break;
      case 'errors':
        cmp = a.summary.errors - b.summary.errors;
        break;
      case 'warnings':
        cmp = a.summary.warnings - b.summary.warnings;
        break;
      case 'fixable':
        cmp = a.summary.fixable - b.summary.fixable;
        break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  // 이슈가 있는 파일만 필터 (이슈 0인 파일은 하단에 표시)
  const filesWithIssues = sortedResults.filter((r) => r.summary.total > 0);
  const filesWithoutIssues = sortedResults.filter((r) => r.summary.total === 0);
  const displayResults = [...filesWithIssues, ...filesWithoutIssues];

  const fixableCount = results.filter((r) => r.summary.fixable > 0 && r.fixedContent).length;
  const progressPercent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="flex flex-col h-full">
      {/* 상단 액션 바 */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-700 bg-gray-800/50">
        {/* 전체 스캔 버튼 */}
        <button
          onClick={scanAllFiles}
          disabled={scanning || fixing}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {scanning ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Play size={14} />
          )}
          {scanning ? '스캔 중...' : '전체 스캔'}
        </button>

        {/* 일괄 수정 버튼 */}
        {fixableCount > 0 && (
          <button
            onClick={handleFixAll}
            disabled={scanning || fixing}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-emerald-600 rounded hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {fixing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Wrench size={14} />
            )}
            {fixing ? '수정 중...' : `일괄 수정 (${fixableCount}개 파일)`}
          </button>
        )}

        {/* 요약 바 */}
        {summary && (
          <div className="flex items-center gap-4 ml-auto text-xs">
            <span className="text-gray-400">
              <FileCode size={12} className="inline mr-1" />
              전체 <span className="text-gray-200 font-semibold">{summary.totalFiles}</span>개
            </span>
            <span className="text-gray-400">
              이슈 <span className="text-gray-200 font-semibold">{summary.totalIssues}</span>건
            </span>
            <span className="text-red-400">
              <AlertCircle size={12} className="inline mr-1" />
              오류 <span className="font-semibold">{summary.totalErrors}</span>
            </span>
            <span className="text-amber-400">
              <AlertTriangle size={12} className="inline mr-1" />
              경고 <span className="font-semibold">{summary.totalWarnings}</span>
            </span>
            <span className="text-emerald-400">
              <Wrench size={12} className="inline mr-1" />
              수정 가능 <span className="font-semibold">{summary.totalFixable}</span>
            </span>
          </div>
        )}
      </div>

      {/* 스캔 진행률 바 */}
      {scanning && progress.total > 0 && (
        <div className="px-4 py-2 border-b border-gray-700 bg-gray-800/30">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-400">
              {progress.current} / {progress.total} 파일 분석 중
            </span>
            <span className="text-xs text-gray-500">{progressPercent}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500 truncate" title={progress.currentFile}>
            {progress.currentFile}
          </p>
        </div>
      )}

      {/* 에러 표시 */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-red-800/50 bg-red-900/20">
          <AlertCircle size={14} className="text-red-400 shrink-0" />
          <span className="text-xs text-red-400">{error}</span>
        </div>
      )}

      {/* 결과 테이블 */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        {results.length > 0 ? (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-800 border-b border-gray-700">
              <tr>
                <SortableHeader
                  field="filePath"
                  label="파일명"
                  currentField={sortField}
                  direction={sortDir}
                  onSort={handleSort}
                  className="text-left min-w-[280px]"
                />
                <SortableHeader
                  field="total"
                  label="이슈수"
                  currentField={sortField}
                  direction={sortDir}
                  onSort={handleSort}
                  className="text-center w-[80px]"
                />
                <SortableHeader
                  field="errors"
                  label="오류"
                  currentField={sortField}
                  direction={sortDir}
                  onSort={handleSort}
                  className="text-center w-[70px]"
                />
                <SortableHeader
                  field="warnings"
                  label="경고"
                  currentField={sortField}
                  direction={sortDir}
                  onSort={handleSort}
                  className="text-center w-[70px]"
                />
                <SortableHeader
                  field="fixable"
                  label="자동수정"
                  currentField={sortField}
                  direction={sortDir}
                  onSort={handleSort}
                  className="text-center w-[80px]"
                />
                <th className="px-4 py-2 text-center font-medium text-gray-400 w-[140px]">
                  액션
                </th>
              </tr>
            </thead>
            <tbody>
              {displayResults.map((result) => (
                <ResultRow
                  key={result.filePath}
                  result={result}
                  onOpen={handleOpenFile}
                  onFix={handleFixFile}
                />
              ))}
            </tbody>
          </table>
        ) : !scanning ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
            <FileSearch size={40} className="text-gray-600" />
            <p className="text-sm">파일 스캔 결과가 없습니다.</p>
            <p className="text-xs text-gray-600">
              "전체 스캔" 버튼을 눌러 프로젝트의 모든 파일을 분석하세요.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** 정렬 가능한 테이블 헤더 */
function SortableHeader({
  field,
  label,
  currentField,
  direction,
  onSort,
  className = '',
}: {
  field: SortField;
  label: string;
  currentField: SortField;
  direction: SortDir;
  onSort: (field: SortField) => void;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-2 font-medium text-gray-400 cursor-pointer hover:text-gray-200 select-none ${className}`}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {currentField === field && (
          <ArrowUpDown
            size={12}
            className={`text-blue-400 ${direction === 'desc' ? 'rotate-180' : ''}`}
          />
        )}
      </span>
    </th>
  );
}

/** 결과 행 */
function ResultRow({
  result,
  onOpen,
  onFix,
}: {
  result: FileAnalysisResult;
  onOpen: (filePath: string) => void;
  onFix: (result: FileAnalysisResult) => void;
}) {
  const { filePath, summary } = result;
  const hasIssues = summary.total > 0;
  const hasFixable = summary.fixable > 0 && !!result.fixedContent;

  return (
    <tr className={`border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${!hasIssues ? 'opacity-50' : ''}`}>
      {/* 파일명 */}
      <td className="px-4 py-2">
        <div className="flex items-center gap-1.5" title={filePath}>
          <FileCode size={12} className="text-gray-500 shrink-0" />
          <span className="text-gray-300 truncate max-w-[260px]">
            {filePath}
          </span>
        </div>
      </td>

      {/* 이슈수 */}
      <td className="px-4 py-2 text-center">
        {summary.total > 0 ? (
          <span className="text-gray-200 font-semibold">{summary.total}</span>
        ) : (
          <CheckCircle2 size={14} className="inline text-green-500" />
        )}
      </td>

      {/* 오류 */}
      <td className="px-4 py-2 text-center">
        {summary.errors > 0 ? (
          <span className="inline-flex items-center gap-1 text-red-400 font-semibold">
            <AlertCircle size={12} />
            {summary.errors}
          </span>
        ) : (
          <span className="text-gray-600">0</span>
        )}
      </td>

      {/* 경고 */}
      <td className="px-4 py-2 text-center">
        {summary.warnings > 0 ? (
          <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
            <AlertTriangle size={12} />
            {summary.warnings}
          </span>
        ) : (
          <span className="text-gray-600">0</span>
        )}
      </td>

      {/* 자동수정 */}
      <td className="px-4 py-2 text-center">
        {summary.fixable > 0 ? (
          <span className="inline-flex items-center gap-1 text-blue-400 font-semibold">
            <Wrench size={12} />
            {summary.fixable}
          </span>
        ) : (
          <span className="text-gray-600">0</span>
        )}
      </td>

      {/* 액션 */}
      <td className="px-4 py-2 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <button
            onClick={() => onOpen(filePath)}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-300 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
            title="에디터에서 열기"
          >
            <ExternalLink size={11} />
            열기
          </button>
          {hasFixable && (
            <button
              onClick={() => onFix(result)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-emerald-300 bg-emerald-700/30 rounded hover:bg-emerald-700/50 transition-colors"
              title="자동 수정 적용"
            >
              <Wrench size={11} />
              수정
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
