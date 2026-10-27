import type { ReaderAiModel } from "../../../../shared/types/readerAiSettings";

// Runtime values stay in the backend package; shared TS files belong to an ESM package.
export const readerAiModels: readonly ReaderAiModel[] = [
  "default",
  "gpt-4.1-mini",
  "gpt-6-luna",
  "gpt-6.1-terra",
  "gpt-6.1-sol",
  "gpt-6-astra",
];