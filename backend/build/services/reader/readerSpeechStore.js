"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readerSpeechStore = exports.ReaderSpeechStore = void 0;
const crypto_1 = require("crypto");
const errorService_1 = require("../error/errorService");
const readerSpeechConfig_1 = require("./readerSpeechConfig");
class ReaderSpeechStore {
    constructor(limits = readerSpeechConfig_1.readerSpeechLimits) {
        this.limits = limits;
        this.entries = new Map();
        this.jobs = new Map();
        this.budgets = new Map();
        this.bytes = 0;
    }
    key(scope, model, voice, text, aligned = false) {
        return (0, crypto_1.createHash)("sha256")
            .update(JSON.stringify(["reader-speech-v2", scope, model, voice, text, aligned]))
            .digest("hex");
    }
    prune(now) {
        for (const [id, entry] of this.entries)
            if (entry.expiresAt <= now) {
                this.entries.delete(id);
                this.bytes -= entry.wav.length;
            }
        for (const [user, budget] of this.budgets)
            if (now - budget.started >= 3600000 && !this.jobs.has(user))
                this.budgets.delete(user);
    }
    get(id, scope, now = Date.now()) {
        this.prune(now);
        const entry = this.entries.get(id);
        if (!entry || entry.scope !== scope)
            return undefined;
        this.entries.delete(id);
        this.entries.set(id, entry);
        return entry;
    }
    put(input, now = Date.now()) {
        this.prune(now);
        const entry = Object.assign(Object.assign({}, input), { expiresAt: now + this.limits.cacheTtlMs });
        if (entry.wav.length > this.limits.cacheBytes)
            throw new errorService_1.AppError("Narration audio exceeds the cache capacity.", 502);
        const previous = this.entries.get(entry.id);
        if (previous) {
            this.bytes -= previous.wav.length;
            this.entries.delete(entry.id);
        }
        while (this.entries.size &&
            (this.entries.size >= this.limits.cacheEntries ||
                this.bytes + entry.wav.length > this.limits.cacheBytes)) {
            const oldest = this.entries.keys().next().value;
            this.bytes -= this.entries.get(oldest).wav.length;
            this.entries.delete(oldest);
        }
        this.entries.set(entry.id, entry);
        this.bytes += entry.wav.length;
        return entry;
    }
    reserve(user, scope, requestId, chars, now = Date.now()) {
        this.prune(now);
        if (this.jobs.has(user))
            throw new errorService_1.AppError("Another audiobook passage is being prepared. Wait or cancel it first.", 409);
        if (this.jobs.size >= this.limits.concurrent)
            throw new errorService_1.AppError("Audiobook generation is busy. Try again shortly.", 429);
        let budget = this.budgets.get(user);
        if (!budget || now - budget.started >= 3600000) {
            if (!budget && this.budgets.size >= 128)
                throw new errorService_1.AppError("Audiobook generation is at capacity.", 429);
            budget = { started: now, chars: 0, requestStart: now, requests: 0 };
        }
        if (now - budget.requestStart >= 600000) {
            budget.requestStart = now;
            budget.requests = 0;
        }
        if (budget.chars + chars > this.limits.charsPerHour ||
            budget.requests >= this.limits.requestsPerTenMinutes)
            throw new errorService_1.AppError("Audiobook generation usage limit reached. Wait before requesting more audio.", 429);
        budget.chars += chars;
        budget.requests++;
        this.budgets.set(user, budget);
        const job = { scope, requestId, controller: new AbortController() };
        this.jobs.set(user, job);
        return {
            signal: job.controller.signal,
            cancel: () => job.controller.abort(),
            release: () => {
                if (this.jobs.get(user) === job)
                    this.jobs.delete(user);
            },
        };
    }
    cancel(user, scope, requestId) {
        const job = this.jobs.get(user);
        if ((job === null || job === void 0 ? void 0 : job.scope) === scope && job.requestId === requestId)
            job.controller.abort();
    }
}
exports.ReaderSpeechStore = ReaderSpeechStore;
exports.readerSpeechStore = new ReaderSpeechStore();
//# sourceMappingURL=readerSpeechStore.js.map