import type { Request, Response, NextFunction } from 'express';
import type { ApiError } from '../../shared/types/api.js';
import { logger } from '../utils/logger.js';

/** 전역 에러 핸들러 */
export function errorHandler(
  err: Error & { statusCode?: number; code?: string },
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err.statusCode ?? 500;
  const code = err.code ?? 'INTERNAL_ERROR';

  logger.error(`${code}: ${err.message}`);

  const body: ApiError = {
    error: {
      code,
      message: err.message,
    },
  };

  res.status(statusCode).json(body);
}
