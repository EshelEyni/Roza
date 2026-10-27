// Runtime configuration stays inside the backend CommonJS package.
export const readerAiConfig = {
  maxQuestionChars: 10000,
  maxPassageChars: 20000,
  maxInstructionsChars: 8000,
  maxAnswerChars: 48000,
  maxBookContextChars: 16000,
  historyBytes: 80000,
  recallBytes: 16000,
  maxRecentPairs: 24,
  maxRequestBytes: 240000,
  maxSavedConversationBytes: 8 * 1024 * 1024,
  timeoutMs: 120000,
  lockMs: 180000,
  outputTokens: 4000,
  reasoningOutputTokens: 12000,
} as const;
