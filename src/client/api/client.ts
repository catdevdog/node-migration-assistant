import type { ApiResponse, ApiError } from '@shared/types/api';

const BASE_URL = '/api';

/** zustand persist 저장소에서 API 키 추출 */
function getApiKey(): string | null {
  try {
    const raw = localStorage.getItem('node-migrator-settings');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.apiKey ?? null;
  } catch {
    return null;
  }
}

class ApiClientError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'ApiClientError';
  }
}

/** API 요청 헬퍼 */
async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  options?: {
    body?: unknown;
    params?: Record<string, string>;
    headers?: Record<string, string>;
  },
): Promise<T> {
  let url = `${BASE_URL}${path}`;

  // 쿼리 파라미터 추가
  if (options?.params) {
    const searchParams = new URLSearchParams(options.params);
    url += `?${searchParams.toString()}`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  // localStorage에서 API 키 가져오기 (zustand persist 저장소)
  const apiKey = getApiKey();
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as ApiError | null;
    throw new ApiClientError(
      errorBody?.error?.code ?? 'NETWORK_ERROR',
      errorBody?.error?.message ?? `요청 실패: ${response.status} ${response.statusText}`,
    );
  }

  const result = (await response.json()) as ApiResponse<T>;
  return result.data;
}

export const apiClient = {
  get: <T>(path: string, params?: Record<string, string>) =>
    request<T>('GET', path, { params }),

  post: <T>(path: string, body?: unknown) =>
    request<T>('POST', path, { body }),
};
