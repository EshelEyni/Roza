import { ReaderSpeechStore } from "./readerSpeechStore";
import { readerSpeechConfig, readerSpeechTranscriptKey } from "./readerSpeechConfig";

const limits = {
  cacheBytes: 12,
  cacheEntries: 2,
  cacheTtlMs: 100,
  concurrent: 2,
  requestsPerTenMinutes: 2,
  charsPerHour: 10,
};
function entry(id: string, scope = "owner") {
  return {
    id,
    scope,
    model: "model",
    voice: "marin",
    text: "Book",
    transcript: "Book",
    wav: Buffer.alloc(6),
    durationSeconds: 1,
  };
}
describe("audiobook cache and admission limits", () => {
  it("isolates cached audio by owner/book/edition and fingerprints synthesis inputs", () => {
    const store = new ReaderSpeechStore(limits);
    const key = store.key("owner:book:edition", "model", "marin", "text");
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(store.key("other:book:edition", "model", "marin", "text")).not.toBe(key);
    expect(store.key("owner:book:new-edition", "model", "marin", "text")).not.toBe(key);
    expect(store.key("owner:book:edition", "model", "cedar", "text")).not.toBe(key);
    store.put(entry(key), 0);
    expect(store.get(key, "someone-else", 1)).toBeUndefined();
    expect(store.get(key, "owner", 1)).toMatchObject({ id: key });
  });
  it("enforces LRU byte/count bounds and a fixed expiry", () => {
    const store = new ReaderSpeechStore(limits);
    store.put(entry("a"), 0);
    store.put(entry("b"), 1);
    store.get("a", "owner", 2);
    store.put(entry("c"), 3);
    expect(store.get("b", "owner", 4)).toBeUndefined();
    expect(store.get("a", "owner", 99)).toBeDefined();
    expect(store.get("a", "owner", 100)).toBeUndefined();
    expect(() => store.put({ ...entry("huge"), wav: Buffer.alloc(13) }, 5)).toThrow(/capacity/);
  });
  it("replaces entries without leaking the cache byte count", () => {
    const store = new ReaderSpeechStore(limits);
    store.put(entry("a"), 0);
    store.put(entry("a"), 1);
    store.put(entry("b"), 2);
    expect(store.get("a", "owner", 3)).toBeDefined();
    expect(store.get("b", "owner", 3)).toBeDefined();
  });
  it("allows one active job per user and bounds total jobs", () => {
    const store = new ReaderSpeechStore(limits);
    const one = store.reserve("one", "book", "request-one", 1, 0);
    expect(() => store.reserve("one", "book", "request-two", 1, 0)).toThrow(/Another/);
    const two = store.reserve("two", "book", "request-two", 1, 0);
    expect(() => store.reserve("three", "book", "request-three", 1, 0)).toThrow(/busy/);
    one.release();
    two.release();
    expect(() => store.reserve("three", "book", "request-three", 1, 1)).not.toThrow();
  });
  it("only cancels the matching user's book and request, and charges aborted attempts", () => {
    const store = new ReaderSpeechStore(limits);
    const job = store.reserve("one", "book", "request-one", 6, 0);
    store.cancel("two", "book", "request-one");
    store.cancel("one", "other-book", "request-one");
    store.cancel("one", "book", "other-request");
    expect(job.signal.aborted).toBe(false);
    store.cancel("one", "book", "request-one");
    expect(job.signal.aborted).toBe(true);
    job.release();
    expect(() => store.reserve("one", "book", "request-two", 6, 1)).toThrow(/usage limit/);
    expect(() => store.reserve("one", "book", "request-three", 6, 3600001)).not.toThrow();
  });
  it("limits generation request frequency even for tiny inputs", () => {
    const store = new ReaderSpeechStore(limits);
    for (let i = 0; i < 2; i++) store.reserve("one", "book", "request-" + i, 1, 0).release();
    expect(() => store.reserve("one", "book", "third", 1, 1)).toThrow(/usage limit/);
    expect(() => store.reserve("one", "book", "next-window", 1, 600001)).not.toThrow();
  });
});
describe("audiobook configuration and transcript comparison", () => {
  const environment = { ...process.env };
  afterEach(() => {
    process.env = { ...environment };
  });
  it("is disabled by default and does not mistake a missing key for readiness", () => {
    delete process.env.READER_AUDIOBOOK_ENABLED;
    delete process.env.READER_AUDIOBOOK_OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    expect(readerSpeechConfig()).toMatchObject({
      enabled: false,
      available: false,
      model: "gpt-realtime-2.1-mini",
    });
    process.env.READER_AUDIOBOOK_ENABLED = "true";
    expect(readerSpeechConfig().available).toBe(false);
    process.env.OPENAI_API_KEY = "test-only";
    expect(readerSpeechConfig().available).toBe(true);
  });
  it("rejects arbitrary models and accepts a separate server speech key", () => {
    process.env.READER_AUDIOBOOK_MODEL = "unapproved-expensive-model";
    expect(() => readerSpeechConfig()).toThrow(/supported/);
    delete process.env.READER_AUDIOBOOK_MODEL;
    process.env.READER_AUDIOBOOK_OPENAI_API_KEY = "speech-key";
    process.env.OPENAI_API_KEY = "chat-key";
    expect(readerSpeechConfig().key).toBe("speech-key");
  });
  it("tolerates punctuation/case while retaining word boundaries and combining marks", () => {
    expect(readerSpeechTranscriptKey("“Hello, WORLD!”")).toBe(
      readerSpeechTranscriptKey("Hello world."),
    );
    expect(readerSpeechTranscriptKey("Don't")).toBe(readerSpeechTranscriptKey("Don’t"));
    expect(readerSpeechTranscriptKey("nowhere")).not.toBe(readerSpeechTranscriptKey("now here"));
    expect(readerSpeechTranscriptKey("कि")).not.toBe(readerSpeechTranscriptKey("क"));
  });
});
