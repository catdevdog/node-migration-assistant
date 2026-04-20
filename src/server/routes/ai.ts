import { Router } from 'express';
import type { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { validateApiKey, streamAIResponse, getEstimate } from '../services/aiService.js';
import { readFile } from '../services/fileService.js';
import { AI_CONFIG } from '../../shared/constants.js';
import type { ApiResponse } from '../../shared/types/api.js';
import type { AIRequestType, AITokenEstimate, APIKeyValidation } from '../../shared/types/ai.js';
import type { RuleMatch } from '../../shared/types/rule.js';
import { logger } from '../utils/logger.js';

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

/**
 * POST /api/ai/guide-analysis  마이그레이션 가이드 기반 파일별 AI 분석 (SSE)
 * 선택된 파일을 가이드 텍스트로 하나씩 검사하여 이슈를 JSON으로 반환
 */
router.post('/guide-analysis', async (req: Request, res: Response) => {
  const apiKey = req.headers['x-api-key'] as string;
  if (!apiKey) {
    res.status(401).json({ error: { code: 'NO_API_KEY', message: 'API 키가 필요합니다.' } });
    return;
  }

  const projectPath = req.app.locals.projectPath as string;
  const { filePaths, migrationGuide, currentNodeVersion, targetNodeVersion } = req.body as {
    filePaths: string[];
    migrationGuide: string;
    currentNodeVersion?: string;
    targetNodeVersion?: string;
  };

  if (!filePaths?.length || !migrationGuide?.trim()) {
    res.status(400).json({ error: { code: 'MISSING_PARAMS', message: '파일 목록과 가이드가 필요합니다.' } });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const client = new Anthropic({ apiKey });
  const total = filePaths.length;
  const current = currentNodeVersion ?? '알 수 없음';
  const target = targetNodeVersion ?? '20';

  const systemPrompt =
    `Node.js/React 마이그레이션 전문가. 주어진 마이그레이션 가이드를 기준으로 파일 이슈를 찾아 JSON으로만 응답.\n` +
    `반드시 순수 JSON 배열만 응답. 다른 텍스트·마크다운 없이.\n` +
    `형식: [{"line": 줄번호, "message": "이슈 설명 (한국어)", "severity": "error|warning|info"}]\n` +
    `이슈 없으면: []`;

  res.write(`data: ${JSON.stringify({ type: 'start', total })}\n\n`);

  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];
    res.write(`data: ${JSON.stringify({ type: 'progress', filePath, current: i + 1, total })}\n\n`);

    try {
      const { content } = await readFile(projectPath, filePath);
      // 파일이 너무 크면 앞부분만 전달 (토큰 제한 대응)
      const MAX_CHARS = 40_000;
      const truncated = content.length > MAX_CHARS
        ? content.slice(0, MAX_CHARS) + '\n// ... (이하 생략)'
        : content;

      const userMessage =
        `마이그레이션 가이드:\n${migrationGuide}\n\n` +
        `Node ${current} → ${target}\n` +
        `파일: ${filePath}\n\`\`\`\n${truncated}\n\`\`\`\n\n` +
        `위 파일에서 마이그레이션 가이드 기반 이슈를 JSON으로 응답:`;

      const message = await client.messages.create({
        model: AI_CONFIG.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });

      const responseText =
        message.content[0]?.type === 'text' ? message.content[0].text : '[]';

      // JSON 배열 추출 (AI가 부연 텍스트를 포함할 경우 대비)
      let issues: Array<{ line?: number; message?: string; severity?: string }> = [];
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try { issues = JSON.parse(jsonMatch[0]); } catch { /* 파싱 실패 → 빈 배열 */ }
      }

      const matches: RuleMatch[] = issues
        .filter((iss) => iss.message)
        .map((iss) => ({
          ruleId: 'ai/guide-analysis',
          ruleName: 'AI 가이드 분석',
          line: typeof iss.line === 'number' ? iss.line : 0,
          column: 0,
          endLine: typeof iss.line === 'number' ? iss.line : 0,
          endColumn: 0,
          message: iss.message ?? '',
          severity: (['error', 'warning', 'info'].includes(iss.severity ?? '')
            ? iss.severity
            : 'warning') as 'error' | 'warning' | 'info',
          fixable: false,
          needsAI: true,
          aiReason: '마이그레이션 가이드 기반 AI 분석',
        }));

      logger.info(`가이드 분석 완료: ${filePath} (${matches.length}건)`);
      res.write(`data: ${JSON.stringify({ type: 'file-done', filePath, matches })}\n\n`);
    } catch (err: any) {
      logger.warn(`가이드 분석 실패: ${filePath} — ${err.message}`);
      res.write(`data: ${JSON.stringify({ type: 'file-error', filePath, error: err.message })}\n\n`);
    }
  }

  res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  res.end();
});

export default router;
