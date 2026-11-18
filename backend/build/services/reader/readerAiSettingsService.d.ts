import { type ReaderInstructionGroup } from "./readerInstructionService";
import type { ReaderAiSettings } from "../../../../shared/types/readerAiSettings";
declare const defaultReaderAiSettings: ReaderAiSettings;
declare function validateReaderAiSettings(value: unknown): ReaderAiSettings;
declare function getReaderAiSettings(userId: string): Promise<ReaderAiSettings>;
declare function saveReaderAiSettings(userId: string, value: unknown): Promise<ReaderAiSettings>;
declare function readerStyleInstructionSections(settings: ReaderAiSettings, selectionOnly?: boolean): ReaderInstructionGroup;
declare function readerStyleInstructions(settings: ReaderAiSettings, selectionOnly?: boolean): string;
export { defaultReaderAiSettings, validateReaderAiSettings, getReaderAiSettings, saveReaderAiSettings, readerStyleInstructions, readerStyleInstructionSections, };
