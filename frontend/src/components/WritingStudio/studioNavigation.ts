import type { BooKDataItemType } from "../../../../shared/types/books";

export type StudioSection = BooKDataItemType | "overview" | "tasks";
export const studioSections: StudioSection[] = [
  "chapters",
  "overview",
  "tasks",
  "characters",
  "plotlines",
  "themes",
  "notes",
];
export const sectionLabel = (value: StudioSection) =>
  value === "overview"
    ? "Chapter Overview"
    : value[0].toUpperCase() + value.slice(1);
