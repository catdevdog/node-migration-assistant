import { useRef, useCallback, useEffect } from 'react';
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

  // 언마운트 시 에디터 안전 정리 — TextModel dispose 순서 문제 방지
  useEffect(() => {
    return () => {
      if (diffRef.current) {
        try {
          diffRef.current.dispose();
        } catch {
          // "TextModel got disposed before DiffEditorWidget" 에러 무시
        }
        diffRef.current = null;
      }
    };
  }, []);

  return (
    <DiffEditor
      height="100%"
      language={language}
      original={original}
      modified={modified}
      theme="vs-dark"
      onMount={handleMount}
      keepCurrentOriginalModel
      keepCurrentModifiedModel
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
