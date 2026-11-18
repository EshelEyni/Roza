import { ReaderContext } from "./readerContextService";
export declare function createReaderContextCache(maxBytes?: number): (key: string, load: () => Promise<Buffer>) => Promise<ReaderContext>;
export declare const cachedReaderContext: (key: string, load: () => Promise<Buffer>) => Promise<ReaderContext>;
