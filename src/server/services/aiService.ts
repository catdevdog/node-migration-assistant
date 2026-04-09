import Anthropic from '@anthropic-ai/sdk';
import { AI_CONFIG } from '../../shared/constants.js';
import type {
  AIAnalyzeRequest,
  AIRewriteRequest,
  AIReplaceLibraryRequest,
  AICascadeRequest,
  AIExplainErrorRequest,
  AISuggestImprovementsRequest,
  AITokenUsage,
  AITokenEstimate,
  AIModelPricing,
  APIKeyValidation,
} from '../../shared/types/ai.js';
import { logger } from '../utils/logger.js';

/** 모델 가격 정보 */
const MODEL_PRICING: AIModelPricing = {
  model: AI_CONFIG.model,
  inputPricePerMToken: 3,    // $3 per 1M input tokens
  outputPricePerMToken: 15,  // $15 per 1M output tokens
};

/** 대략적인 토큰 수 추정 (4글자 ≈ 1토큰, 한국어는 2글자 ≈ 1토큰) */
function estimateTokenCount(text: string): number {
  // 영어 ~4글자/토큰, 한국어 ~2글자/토큰 기준 휴리스틱
  const koreanChars = (text.match(/[\uAC00-\uD7AF\u3130-\u318F]/g) || []).length;
  const otherChars = text.length - koreanChars;
  return Math.ceil(koreanChars / 2 + otherChars / 4);
}

/** 비용 계산 */
function calculateCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens * MODEL_PRICING.inputPricePerMToken +
      outputTokens * MODEL_PRICING.outputPricePerMToken) /
    1_000_000
  );
}

/** 토큰/비용 사전 추정 */
export function estimateTokens(
  systemPrompt: string,
  userMessage: string,
  expectedOutputTokens?: number,
): AITokenEstimate {
  const inputTokens =
    estimateTokenCount(systemPrompt) + estimateTokenCount(userMessage);
  const outputTokens =
    expectedOutputTokens ?? Math.min(inputTokens * 2, AI_CONFIG.maxTokens);
  const estimatedCostUSD = calculateCost(inputTokens, outputTokens);

  return {
    estimatedInputTokens: inputTokens,
    estimatedOutputTokens: outputTokens,
    estimatedCostUSD,
    warning:
      estimatedCostUSD > 0.05
        ? `예상 비용이 $${estimatedCostUSD.toFixed(3)}입니다. 계속하시겠습니까?`
        : undefined,
  };
}

/** API 키 유효성 검증 */
export async function validateApiKey(
  apiKey: string,
): Promise<APIKeyValidation> {
  try {
    const client = new Anthropic({ apiKey });
    // 최소한의 요청으로 키 유효성 확인
    await client.messages.create({
      model: AI_CONFIG.model,
      max_tokens: 10,
      messages: [{ role: 'user', content: 'ping' }],
    });
    return { valid: true, message: 'API 키가 유효합니다.' };
  } catch (err: any) {
    if (err?.status === 401) {
      return { valid: false, message: '유효하지 않은 API 키입니다.' };
    }
    if (err?.status === 403) {
      return { valid: false, message: 'API 키 권한이 부족합니다.' };
    }
    return {
      valid: false,
      message: `검증 실패: ${err?.message ?? '알 수 없는 에러'}`,
    };
  }
}

/** 시스템 프롬프트 빌더 */
function buildSystemPrompt(
  type: string,
  context: Record<string, any> = {},
): string {
  const base = `Node.js 마이그레이션 전문가. 한국어로 응답.
규칙:
- 마크다운 문법 사용 금지 (**, ##, - 등). 평문으로 작성.
- 수정된 코드는 반드시 \`\`\`언어 코드블록으로 제공. 파일 전체 코드를 포함할 것.
- 설명은 핵심만 간결하게. 불필요한 인사/서론/반복 금지.
- Node.js 버전별 차이를 명시.`;

  const target = context.targetNodeVersion ?? '20';
  const current = context.currentNodeVersion ?? '알 수 없음';

  const typePrompts: Record<string, string> = {
    analyze: `${base}
Node ${current} → ${target} 마이그레이션. 이슈별로: 문제, 위험도, 수정코드 제공.`,

    rewrite: `${base}
Node ${target}에 맞게 파일 전체 재작성. 변경마다 // CHANGED: 주석. 동일 동작 보장.`,

    'replace-library': `${base}
deprecated 라이브러리를 현대적 대안으로 교체. 단계별 코드 제공.`,

    cascade: `${base}
파일 수정의 연쇄 영향 분석. 영향 파일별 필요 변경사항 제시.`,

    'explain-error': `${base}
마이그레이션 에러 분석. 원인, 해결방법 코드 제공.`,

    'suggest-improvements': `${base}
Node ${target}에서 활용 가능한 개선사항. 성능/보안/최신API 관점.`,
  };

  return typePrompts[type] ?? base;
}

/** 요청 유형별 사용자 메시지 생성 */
function buildUserMessage(type: string, request: any): string {
  switch (type) {
    case 'analyze': {
      const r = request as AIAnalyzeRequest;
      const matches = r.matches ?? [];
      if (matches.length > 0) {
        const issueList = matches
          .map(
            (m, i) =>
              `${i + 1}. [Line ${m.line}] ${m.message}${m.aiReason ? ` (AI 분석 필요: ${m.aiReason})` : ''}`,
          )
          .join('\n');
        return `파일: ${r.filePath}\n\n감지된 이슈:\n${issueList}\n\n코드:\n\`\`\`\n${r.content}\n\`\`\``;
      }
      // matches가 없으면 전체 파일 분석
      return `파일: ${r.filePath}\n\n코드를 분석하여 마이그레이션 시 주의할 사항을 알려주세요.\n\n코드:\n\`\`\`\n${r.content}\n\`\`\``;
    }
    case 'rewrite': {
      const r = request as AIRewriteRequest;
      return `파일: ${r.filePath}\n${r.instructions ? `\n지시사항: ${r.instructions}\n` : ''}\n코드:\n\`\`\`\n${r.content}\n\`\`\``;
    }
    case 'replace-library': {
      const r = request as AIReplaceLibraryRequest;
      return `라이브러리: ${r.libraryName} (현재 버전: ${r.currentVersion})\n${r.recommendation ? `추천 대안: ${r.recommendation}\n` : ''}\n사용 코드:\n\`\`\`\n${r.content}\n\`\`\``;
    }
    case 'cascade': {
      const r = request as AICascadeRequest;
      const relatedFiles = r.relatedFiles ?? [];
      const relatedList = relatedFiles.length > 0
        ? relatedFiles.map((f) => `--- ${f.path} ---\n${f.content}`).join('\n\n')
        : '(연관 파일 없음)';
      return `변경된 파일: ${r.filePath}\n\n원본:\n\`\`\`\n${r.originalContent}\n\`\`\`\n\n변경 후:\n\`\`\`\n${r.changedContent}\n\`\`\`\n\n연관 파일:\n${relatedList}`;
    }
    case 'explain-error': {
      const r = request as AIExplainErrorRequest;
      return `에러 유형: ${r.errorType}\n에러 메시지:\n${r.errorMessage}\n${r.filePath ? `\n파일: ${r.filePath}` : ''}${r.content ? `\n\n코드:\n\`\`\`\n${r.content}\n\`\`\`` : ''}`;
    }
    case 'suggest-improvements': {
      const r = request as AISuggestImprovementsRequest;
      return `파일: ${r.filePath}\n\n코드:\n\`\`\`\n${r.content}\n\`\`\``;
    }
    default:
      return JSON.stringify(request);
  }
}

/**
 * AI 스트리밍 호출
 * SSE 호환 청크를 yield한 뒤, 최종 토큰 사용량을 반환
 */
export async function* streamAIResponse(
  apiKey: string,
  type: string,
  request: any,
): AsyncGenerator<{
  type: 'text' | 'usage';
  content?: string;
  usage?: AITokenUsage;
}> {
  const client = new Anthropic({ apiKey });

  const systemPrompt = buildSystemPrompt(type, request);
  const userMessage = buildUserMessage(type, request);

  logger.info(`AI 요청 시작: ${type}`);

  const stream = client.messages.stream({
    model: AI_CONFIG.model,
    max_tokens: AI_CONFIG.maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield { type: 'text', content: event.delta.text };
    }
  }

  // 최종 사용량 수집
  const finalMessage = await stream.finalMessage();
  const usage: AITokenUsage = {
    inputTokens: finalMessage.usage.input_tokens,
    outputTokens: finalMessage.usage.output_tokens,
    estimatedCostUSD: calculateCost(
      finalMessage.usage.input_tokens,
      finalMessage.usage.output_tokens,
    ),
  };

  logger.info(
    `AI 응답 완료: 입력 ${usage.inputTokens} / 출력 ${usage.outputTokens} 토큰 ($${usage.estimatedCostUSD.toFixed(4)})`,
  );

  yield { type: 'usage', usage };
}

/** 토큰 예상치 API (호출 전 사전 확인용) */
export function getEstimate(type: string, request: any): AITokenEstimate {
  const systemPrompt = buildSystemPrompt(type, request);
  const userMessage = buildUserMessage(type, request);
  return estimateTokens(systemPrompt, userMessage);
}

export { MODEL_PRICING };
