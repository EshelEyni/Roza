import { ReaderContext } from "./readerContextService";

// Immutable GridFS file IDs identify editions. Cache only book data, never user scope.
export function createReaderContextCache(maxBytes = 64 * 1024 * 1024) {
  const entries = new Map<string, ReaderContext>();
  const pending = new Map<string, Promise<ReaderContext>>();
  let bytes = 0;
  return async (key: string, load: () => Promise<Buffer>) => {
    const cached = entries.get(key);
    if (cached) {
      entries.delete(key);
      entries.set(key, cached);
      return cached;
    }
    const loading = pending.get(key);
    if (loading) return loading;
    const promise = (async () => {
      const context = new ReaderContext(await load());
      if (context.cacheBytes <= maxBytes) {
        while (entries.size && bytes + context.cacheBytes > maxBytes) {
          const oldest = entries.keys().next().value!;
          bytes -= entries.get(oldest)!.cacheBytes;
          entries.delete(oldest);
        }
        entries.set(key, context);
        bytes += context.cacheBytes;
      }
      return context;
    })();
    pending.set(key, promise);
    try { return await promise; } finally { pending.delete(key); }
  };
}
export const cachedReaderContext = createReaderContextCache();
