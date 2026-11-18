export type ReaderInstructionGroup = {
    [title: string]: string | ReaderInstructionGroup | undefined;
};
/** Flatten only active leaves, preserving the configured section/sentence order. */
export declare function readerInstructionText(group: ReaderInstructionGroup): string;
