import { apiClient } from './client';
import type { APIKeyValidation, AITokenEstimate } from '@shared/types/ai';

/** API 키 유효성 검증 */
export async function validateApiKey(apiKey: string): Promise<APIKeyValidation> {
  // API 키를 직접 헤더로 전달 — client.ts는 localStorage에서 읽으므로 별도 처리 필요
  const res = await fetch('/api/ai/validate-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({}),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data;
}

/** 토큰/비용 사전 추정 */
export async function estimateTokens(type: string, request: unknown): Promise<AITokenEstimate> {
  return apiClient.post('/ai/estimate', { type, request });
}

/** AI SSE 스트리밍 요청 */
export function streamAIRequest(
  type: string,
  body: unknown,
  callbacks: {
    onChunk: (text: string) => void;
    onDone: (fullText: string, usage: { inputTokens: number; outputTokens: number; estimatedCostUSD: number }) => void;
    onError: (message: string) => void;
  },
): AbortController {
  const controller = new AbortController();
  // zustand persist 저장소에서 API 키 추출
  let apiKey = '';
  try {
    const raw = localStorage.getItem('node-migrator-settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      apiKey = parsed?.state?.apiKey ?? '';
    }
  } catch { /* 무시 */ }

  fetch(`/api/ai/${type}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok || !res.body) {
        callbacks.onError(`HTTP ${res.status}: 요청 실패`);
        return;
      }

      const reader = res.body.getReader();
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
            if (data.type === 'chunk') {
              callbacks.onChunk(data.content);
            } else if (data.type === 'done') {
              callbacks.onDone(data.fullText, data.usage);
            } else if (data.type === 'error') {
              callbacks.onError(data.message);
            }
          } catch {
            // JSON 파싱 실패 — 무시
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        callbacks.onError(err.message ?? 'AI 요청 실패');
      }
    });

  return controller;
}
