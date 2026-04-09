import { create } from 'zustand';
import type { AIChatMessage, AITokenUsage, AITokenEstimate } from '@shared/types/ai';

interface AIState {
  /** AI 대화 메시지 목록 */
  messages: AIChatMessage[];
  /** 스트리밍 중인 텍스트 */
  currentStreamText: string;
  /** 스트리밍 중 여부 */
  isStreaming: boolean;
  /** 에러 메시지 */
  error: string | null;
  /** 누적 토큰 사용량 */
  totalUsage: AITokenUsage;
  /** 현재 요청의 사전 추정치 */
  currentEstimate: AITokenEstimate | null;
  /** AI 패널 열림 여부 */
  isPanelOpen: boolean;

  // 액션
  /** 사용자 메시지 추가 */
  addUserMessage: (content: string, codeBlock?: AIChatMessage['codeBlock']) => void;
  /** 스트리밍 시작 */
  startStreaming: () => void;
  /** 스트리밍 청크 추가 */
  appendStreamChunk: (text: string) => void;
  /** 스트리밍 완료 — assistant 메시지로 확정 */
  completeStreaming: (fullText: string, usage: AITokenUsage, codeBlock?: AIChatMessage['codeBlock']) => void;
  /** 스트리밍 에러 */
  setStreamError: (message: string) => void;
  /** 에러 클리어 */
  clearError: () => void;
  /** 사전 추정치 설정 */
  setEstimate: (estimate: AITokenEstimate | null) => void;
  /** 대화 초기화 */
  clearMessages: () => void;
  /** AI 패널 토글 */
  togglePanel: () => void;
  /** AI 패널 열기/닫기 */
  setPanel: (open: boolean) => void;
}

export const useAIStore = create<AIState>((set) => ({
  messages: [],
  currentStreamText: '',
  isStreaming: false,
  error: null,
  totalUsage: { inputTokens: 0, outputTokens: 0, estimatedCostUSD: 0 },
  currentEstimate: null,
  isPanelOpen: false,

  addUserMessage: (content, codeBlock) =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: `user-${Date.now()}`,
          role: 'user' as const,
          content,
          timestamp: new Date().toISOString(),
          codeBlock,
        },
      ],
    })),

  startStreaming: () =>
    set({ isStreaming: true, currentStreamText: '', error: null }),

  appendStreamChunk: (text) =>
    set((s) => ({ currentStreamText: s.currentStreamText + text })),

  completeStreaming: (fullText, usage, codeBlock) =>
    set((s) => ({
      isStreaming: false,
      currentStreamText: '',
      messages: [
        ...s.messages,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant' as const,
          content: fullText,
          timestamp: new Date().toISOString(),
          codeBlock,
          usage,
        },
      ],
      totalUsage: {
        inputTokens: s.totalUsage.inputTokens + usage.inputTokens,
        outputTokens: s.totalUsage.outputTokens + usage.outputTokens,
        estimatedCostUSD: s.totalUsage.estimatedCostUSD + usage.estimatedCostUSD,
      },
      currentEstimate: null,
    })),

  setStreamError: (message) =>
    set({ isStreaming: false, currentStreamText: '', error: message }),

  clearError: () => set({ error: null }),

  setEstimate: (estimate) => set({ currentEstimate: estimate }),

  clearMessages: () =>
    set({
      messages: [],
      currentStreamText: '',
      error: null,
      totalUsage: { inputTokens: 0, outputTokens: 0, estimatedCostUSD: 0 },
      currentEstimate: null,
    }),

  togglePanel: () => set((s) => ({ isPanelOpen: !s.isPanelOpen })),

  setPanel: (open) => set({ isPanelOpen: open }),
}));
