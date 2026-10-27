// Mirrors backend readerAiConfig; the server remains authoritative.
export const readerAiLimits = {
  question: 10000,
  passage: 20000,
  instructions: 8000,
} as const;
