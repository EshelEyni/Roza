export type ReaderInstructionGroup = {
  [title: string]: string | ReaderInstructionGroup | undefined;
};

/** Flatten only active leaves, preserving the configured section/sentence order. */
export function readerInstructionText(group: ReaderInstructionGroup): string {
  return Object.values(group)
    .map(value => typeof value === "string" ? value : value ? readerInstructionText(value) : "")
    .filter(Boolean)
    .join("\n");
}
