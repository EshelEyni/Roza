import type { BooKDataItemType } from "../../../../shared/types/books";

export type StudioSection = BooKDataItemType | "overview" | "tasks" | "bible";
export const studioSections: StudioSection[] = [
  "chapters",
  "overview",
  "bible",
  "characters",
  "plotlines",
  "themes",
  "notes",
  "tasks",
];
export const sectionLabel = (value: StudioSection) =>
  value === "bible"
    ? "Story Bible"
    : value === "overview"
      ? "Chapter Overview"
      : value[0].toUpperCase() + value.slice(1);
