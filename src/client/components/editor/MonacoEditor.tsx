import { useRef, useCallback } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

interface MonacoEditorProps {
  value: string;
  language: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  onLineClick?: (line: number) => void;
  /** 강조할 라인 번호 배열 */
  highlightLines?: Array<{ line: number; severity: 'error' | 'warning' | 'info' }>;
}

/** Monaco Editor 래퍼 — 단일 파일 편집용 */
export function MonacoEditor({
  value,
  language,
  readOnly = false,
  onChange,
  highlightLines,
}: MonacoEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);

  const handleMount: OnMount = useCallback((ed) => {
    editorRef.current = ed;
    applyDecorations(ed, highlightLines);
  }, [highlightLines]);

  const handleChange = useCallback((val: string | undefined) => {
    if (val !== undefined && onChange) onChange(val);
  }, [onChange]);

  // 이슈 라인 하이라이트 적용
  function applyDecorations(
    ed: editor.IStandaloneCodeEditor,
    lines?: MonacoEditorProps['highlightLines'],
  ) {
    if (decorationsRef.current) {
      decorationsRef.current.clear();
    }

    if (!lines || lines.length === 0) return;

    const severityClass: Record<string, string> = {
      error: 'line-highlight-error',
      warning: 'line-highlight-warning',
      info: 'line-highlight-info',
    };

    const decorations: editor.IModelDeltaDecoration[] = lines.map((h) => ({
      range: { startLineNumber: h.line, startColumn: 1, endLineNumber: h.line, endColumn: 1 },
      options: {
        isWholeLine: true,
        className: severityClass[h.severity] ?? 'line-highlight-info',
        glyphMarginClassName: `glyph-${h.severity}`,
      },
    }));

    decorationsRef.current = ed.createDecorationsCollection(decorations);
  }

  return (
    <Editor
      height="100%"
      language={language}
      value={value}
      theme="vs-dark"
      onChange={handleChange}
      onMount={handleMount}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        automaticLayout: true,
        tabSize: 2,
        renderWhitespace: 'selection',
        folding: true,
        glyphMargin: true,
        lineDecorationsWidth: 5,
        scrollbar: {
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8,
        },
      }}
    />
  );
}
