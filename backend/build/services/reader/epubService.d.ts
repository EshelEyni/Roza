declare const MAX_EPUB_SIZE: number;
declare function parseEpub(buffer: Buffer, filename: string): {
    title: string;
    author: string;
    cover: string;
    buffer: Buffer;
};
export { parseEpub, MAX_EPUB_SIZE };
