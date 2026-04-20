import { Router } from 'express';
import type { Request, Response } from 'express';
import { validateApiKey, streamAIResponse, getEstimate } from '../services/aiService.js';
import type { ApiResponse } from '../../shared/types/api.js';
import type { AIRequestType, AITokenEstimate, APIKeyValidation } from '../../shared/types/ai.js';

const router = Router();

/**
 * SSE 스트리밍 핸들러 팩토리
 * 모든 AI 스트리밍 엔드포인트에서 동일한 패턴을 재사용한다.
 */
function createSSEHandler(type: AIRequestType) {
  return async (req: Request, res: Response) => {
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) {
      res.status(401).json({
        error: { code: 'NO_API_KEY', message: 'API 키가 필요합니다.' },
      });
      return;
    }

    // SSE 헤더 설정
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    try {
      let fullText = '';
      for await (const chunk of streamAIResponse(apiKey, type, req.body)) {
        if (chunk.type === 'text') {
          fullText += chunk.content;
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk.content })}\n\n`);
        } else if (chunk.type === 'usage') {
          res.write(`data: ${JSON.stringify({ type: 'done', fullText, usage: chunk.usage })}\n\n`);
        }
      }
    } catch (err: any) {
      res.write(
        `data: ${JSON.stringify({ type: 'error', message: err.message ?? 'AI 요청 실패' })}\n\n`,
      );
    }

    res.end();
  };
}

/** POST /api/ai/validate-key  API 키 유효성 검증 */
router.post('/validate-key', async (req: Request, res: Response) => {
  const apiKey = req.headers['x-api-key'] as string;
  if (!apiKey) {
    res.status(401).json({
      error: { code: 'NO_API_KEY', message: 'API 키가 필요합니다.' },
    });
    return;
  }

  try {
    const result = await validateApiKey(apiKey);
    const response: ApiResponse<APIKeyValidation> = {
      data: result,
      meta: { timestamp: new Date().toISOString() },
    };
    res.json(response);
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'VALIDATION_FAILED', message: err.message ?? 'API 키 검증 실패' },
    });
  }
});

/** POST /api/ai/estimate  토큰/비용 사전 예측 (스트리밍 아님) */
router.post('/estimate', (req: Request, res: Response) => {
  const { type, request } = req.body as { type?: AIRequestType; request?: Record<string, unknown> };
  if (!type) {
    res.status(400).json({
      error: { code: 'MISSING_TYPE', message: '요청 유형이 필요합니다.' },
    });
    return;
  }

  const estimate = getEstimate(type, request ?? {});
  const response: ApiResponse<AITokenEstimate> = {
    data: estimate,
    meta: { timestamp: new Date().toISOString() },
  };
  res.json(response);
});

/** POST /api/ai/analyze  AI-02: 애매한 코드 분석 (SSE) */
router.post('/analyze', createSSEHandler('analyze'));

/** POST /api/ai/rewrite  AI-03: 전체 파일 재작성 (SSE) */
router.post('/rewrite', createSSEHandler('rewrite'));

/** POST /api/ai/replace-library  AI-04: 라이브러리 교체 제안 (SSE) */
router.post('/replace-library', createSSEHandler('replace-library'));

/** POST /api/ai/cascade  AI-05: 연쇄 영향 분석 (SSE) */
router.post('/cascade', createSSEHandler('cascade'));

/** POST /api/ai/explain-error  AI-06: 빌드/런타임 에러 설명 (SSE) */
router.post('/explain-error', createSSEHandler('explain-error'));

/** POST /api/ai/suggest-improvements  AI-07: 사전 개선 제안 (SSE) */
router.post('/suggest-improvements', createSSEHandler('suggest-improvements'));

/** POST /api/ai/dependency  AI-08: 의존성 호환성 분석 (SSE) */
router.post('/dependency', createSSEHandler('dependency'));

export default router;
