import { useRef, useCallback } from 'react';
import { DiffEditor, type DiffOnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

interface MonacoDiffEditorProps {
  original: string;
  modified: string;
  language: string;
}

/** Monaco Diff Editor — 원본 vs 수정본 비교 뷰 */
export function MonacoDiffEditor({ original, modified, language }: MonacoDiffEditorProps) {
  const diffRef = useRef<editor.IStandaloneDiffEditor | null>(null);

  const handleMount: DiffOnMount = useCallback((ed) => {
    diffRef.current = ed;
  }, []);

  return (
    <DiffEditor
      height="100%"
      language={language}
      original={original}
      modified={modified}
      theme="vs-dark"
      onMount={handleMount}
      options={{
        readOnly: true,
        minimap: { enabled: false },
        fontSize: 13,
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        automaticLayout: true,
        renderSideBySide: true,
        enableSplitViewResizing: true,
        originalEditable: false,
        scrollbar: {
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8,
        },
      }}
    />
  );
}
