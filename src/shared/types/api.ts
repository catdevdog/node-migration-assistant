/** API 성공 응답 래퍼 */
export interface ApiResponse<T> {
  data: T;
  meta: {
    timestamp: string;
    duration?: number;
  };
}

/** API 에러 응답 */
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/** SSE 이벤트 타입 */
export type SSEEventType = 'chunk' | 'progress' | 'done' | 'error';

export interface SSEEvent<T = unknown> {
  type: SSEEventType;
  data: T;
}

export interface SSEProgressData {
  current: number;
  total: number;
  message?: string;
}
