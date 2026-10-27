export const readerAiModels = [
  "default",
  "gpt-4.1-mini",
  "gpt-6-luna",
  "gpt-6.1-terra",
  "gpt-6.1-sol",
  "gpt-6-astra",
] as const;
export type ReaderAiModel = (typeof readerAiModels)[number];

export type ReaderAiSettings = {
  model?: ReaderAiModel;
  answerLength: "short" | "standard" | "detailed";
  simpleLanguage: boolean;
  customInstructions: string;
};
