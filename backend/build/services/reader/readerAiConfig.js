"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readerAiConfig = void 0;
// Runtime configuration stays inside the backend CommonJS package.
exports.readerAiConfig = {
    maxQuestionChars: 10000,
    maxPassageChars: 20000,
    maxInstructionsChars: 8000,
    maxAnswerChars: 48000,
    maxBookContextChars: 16000,
    historyBytes: 80000,
    recallBytes: 16000,
    maxRecentPairs: 6,
    minRecentPairs: 4,
    maxRecallPairs: 2,
    summaryBatchBytes: 64000,
    maxSummaryInputBytes: 220000,
    maxSummaryChars: 6000,
    summaryOutputTokens: 1800,
    summaryReasoningOutputTokens: 6000,
    summaryTimeoutMs: 45000,
    maxRequestBytes: 240000,
    maxSavedConversationBytes: 8 * 1024 * 1024,
    timeoutMs: 120000,
    lockMs: 180000,
    outputTokens: 4000,
    reasoningOutputTokens: 12000,
};
//# sourceMappingURL=readerAiConfig.js.map