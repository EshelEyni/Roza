"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cachedReaderContext = void 0;
exports.createReaderContextCache = createReaderContextCache;
const readerContextService_1 = require("./readerContextService");
// Immutable GridFS file IDs identify editions. Cache only book data, never user scope.
function createReaderContextCache(maxBytes = 64 * 1024 * 1024) {
    const entries = new Map();
    const pending = new Map();
    let bytes = 0;
    return (key, load) => __awaiter(this, void 0, void 0, function* () {
        const cached = entries.get(key);
        if (cached) {
            entries.delete(key);
            entries.set(key, cached);
            return cached;
        }
        const loading = pending.get(key);
        if (loading)
            return loading;
        const promise = (() => __awaiter(this, void 0, void 0, function* () {
            const context = new readerContextService_1.ReaderContext(yield load());
            if (context.cacheBytes <= maxBytes) {
                while (entries.size && bytes + context.cacheBytes > maxBytes) {
                    const oldest = entries.keys().next().value;
                    bytes -= entries.get(oldest).cacheBytes;
                    entries.delete(oldest);
                }
                entries.set(key, context);
                bytes += context.cacheBytes;
            }
            return context;
        }))();
        pending.set(key, promise);
        try {
            return yield promise;
        }
        finally {
            pending.delete(key);
        }
    });
}
exports.cachedReaderContext = createReaderContextCache();
//# sourceMappingURL=readerContextCache.js.map