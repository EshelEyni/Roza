import { createContext } from "react";
import type { ReaderPassage } from "../../../../shared/types/readerChat";
export type PassageMarks = {
  register: (passage: ReaderPassage) => () => void;
  toggle: (passage: ReaderPassage) => void;
  enabled: (passage: ReaderPassage) => boolean;
};
export const ReaderPassageMarks = createContext<PassageMarks | null>(null);
