import { createReaderContextCache } from "./readerContextCache";
import { ReaderContext } from "./readerContextService";
jest.mock("./readerContextService", () => ({ ReaderContext: jest.fn().mockImplementation(() => ({ cacheBytes: 10 })) }));
describe("Book context cache", () => {
  beforeEach(() => jest.clearAllMocks());
  it("shares simultaneous loads and reuses immutable editions", async () => {
    const cache = createReaderContextCache(20);
    const load = jest.fn(async () => Buffer.from("book"));
    const [a, b] = await Promise.all([cache("one", load), cache("one", load)]);
    expect(a).toBe(b);
    expect(await cache("one", load)).toBe(a);
    expect(load).toHaveBeenCalledTimes(1);
  });
  it("evicts least recently used editions under its byte budget", async () => {
    const cache = createReaderContextCache(20);
    const load = jest.fn(async () => Buffer.from("book"));
    await cache("one", load); await cache("two", load); await cache("one", load);
    await cache("three", load); await cache("two", load);
    expect(load).toHaveBeenCalledTimes(4);
  });
  it("retries failed loads and serves books too large to cache", async () => {
    const cache = createReaderContextCache(5);
    await expect(cache("one", async () => { throw new Error("unavailable"); })).rejects.toThrow("unavailable");
    const load = jest.fn(async () => Buffer.from("book"));
    await cache("one", load); await cache("one", load);
    expect(load).toHaveBeenCalledTimes(2);
    expect(ReaderContext).toHaveBeenCalledTimes(2);
  });
});
