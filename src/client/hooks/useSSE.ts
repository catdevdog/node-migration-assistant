import { useState, useRef, useCallback } from 'react';
import { streamAIRequest } from '../api/ai';
import type { AITokenUsage } from '@shared/types/ai';

interface UseAIStreamOptions {
  onComplete?: (fullText: string, usage: AITokenUsage) => void;
  onError?: (message: string) => void;
}

interface UseAIStreamReturn {
  /** 현재 스트리밍 중인 텍스트 */
  streamText: string;
  /** 스트리밍 중 여부 */
  isStreaming: boolean;
  /** 에러 메시지 */
  error: string | null;
  /** 스트리밍 시작 */
  start: (type: string, body: unknown) => void;
  /** 스트리밍 중단 */
  stop: () => void;
  /** 텍스트 초기화 */
  reset: () => void;
}

export function useAIStream(options: UseAIStreamOptions = {}): UseAIStreamReturn {
  const [streamText, setStreamText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setIsStreaming(false);
  }, []);

  const reset = useCallback(() => {
    stop();
    setStreamText('');
    setError(null);
  }, [stop]);

  const start = useCallback((type: string, body: unknown) => {
    // 이전 스트림 정리
    stop();
    setStreamText('');
    setError(null);
    setIsStreaming(true);

    const controller = streamAIRequest(type, body, {
      onChunk: (text) => {
        setStreamText((prev) => prev + text);
      },
      onDone: (fullText, usage) => {
        setStreamText(fullText);
        setIsStreaming(false);
        controllerRef.current = null;
        options.onComplete?.(fullText, usage);
      },
      onError: (message) => {
        setError(message);
        setIsStreaming(false);
        controllerRef.current = null;
        options.onError?.(message);
      },
    });

    controllerRef.current = controller;
  }, [stop, options]);

  return { streamText, isStreaming, error, start, stop, reset };
}
