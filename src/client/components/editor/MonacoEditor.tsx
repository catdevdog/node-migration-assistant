import { useRef, useEffect } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

interface MonacoEditorProps {
  value: string;
  language: string;
  /** 강조할 라인 번호 배열 */
  highlightLines?: Array<{ line: number; severity: 'error' | 'warning' | 'info' }>;
  /** 에디터 인스턴스가 준비되면 호출 — 라인 이동 등 외부 제어에 사용 */
  onEditorReady?: (editor: editor.IStandaloneCodeEditor) => void;
}

/**
 * Monaco Editor 래퍼 — 항상 읽기 전용.
 * 사용자 직접 편집은 금지되며, 코드 변경은 규칙/AI 제안의 승인 워크플로우로만 가능합니다.
 */
export function MonacoEditor({
  value,
  language,
  highlightLines,
  onEditorReady,
}: MonacoEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);

  const handleMount: OnMount = (ed) => {
    editorRef.current = ed;
    onEditorReady?.(ed);
    applyDecorations(ed, highlightLines);
  };

  // highlightLines 변경 시 데코레이션 갱신
  useEffect(() => {
    if (editorRef.current) {
      applyDecorations(editorRef.current, highlightLines);
    }
  }, [highlightLines]);

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
      onMount={handleMount}
      options={{
        readOnly: true,
        domReadOnly: true,
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
