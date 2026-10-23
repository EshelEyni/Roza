describe("Google Translate fallback", () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  let fetchMock: jest.Mock;
  const translate = (word: string) =>
    (
      require("./googleTranslateService") as typeof import("./googleTranslateService")
    ).translateReaderWord(word);
  const lookup = (word: string) =>
    (
      require("./readerDictionaryService") as typeof import("./readerDictionaryService")
    ).lookupReaderWordWithTranslation(word);
  const success = (text = "מְהַסֵּס") => ({
    ok: true,
    status: 200,
    json: async () => ({ data: { translations: [{ translatedText: text }] } }),
  });

  beforeEach(() => {
    jest.resetModules();
    process.env.GOOGLE_TRANSLATE_API_KEY = "test-only-google-key";
    fetchMock = jest.fn().mockResolvedValue(success());
    global.fetch = fetchMock;
  });
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GOOGLE_TRANSLATE_API_KEY;
    else process.env.GOOGLE_TRANSLATE_API_KEY = originalKey;
    jest.restoreAllMocks();
  });

  it("keeps local words local, including with a configured key", async () => {
    expect((await lookup("book"))?.source).toBe("Wiktionary");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("keeps local lookup working and returns no translation when the key is absent", async () => {
    delete process.env.GOOGLE_TRANSLATE_API_KEY;
    expect((await lookup("book"))?.headword).toBe("book");
    expect(await lookup("zzzxxyy")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("uses Basic v2 with server-only header authentication and explicit English/Hebrew text", async () => {
    const result = await lookup("reluctant");
    expect(result).toMatchObject({
      word: "reluctant",
      headword: "reluctant",
      source: "Google Translate",
      kind: "translation",
      senses: [{ meanings: ["מְהַסֵּס"], definition: "", examples: [] }],
    });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://translation.googleapis.com/language/translate/v2");
    expect(url).not.toContain("test-only-google-key");
    expect(options.headers["x-goog-api-key"]).toBe("test-only-google-key");
    expect(JSON.parse(options.body)).toEqual({
      q: "reluctant",
      source: "en",
      target: "he",
      format: "text",
      model: "nmt",
    });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.stringify(result)).not.toContain("test-only-google-key");
  });
  it("deduplicates concurrent requests and reuses successful results", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => translate("reluctant")));
    expect(results.every(value => value?.source === "Google Translate")).toBe(true);
    await translate("reluctant");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("expires cached results and does not reuse results across API keys", async () => {
    const clock = jest.spyOn(Date, "now").mockReturnValue(1000);
    await translate("reluctant");
    clock.mockReturnValue(1000 + 24 * 60 * 60 * 1000 + 1);
    await translate("reluctant");
    process.env.GOOGLE_TRANSLATE_API_KEY = "another-test-key";
    await translate("reluctant");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it("decodes Google's escaped text safely", async () => {
    fetchMock.mockResolvedValue(success("גר&#39;וזיני &amp; &#x5D0;"));
    expect((await translate("georgian"))?.senses[0].meanings).toEqual(["גר'וזיני & א"]);
  });
  it("does not save echoed English, and briefly caches a missing translation", async () => {
    fetchMock.mockResolvedValue(success("zzzxxyy"));
    expect(await translate("zzzxxyy")).toBeNull();
    expect(await translate("zzzxxyy")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("rejects phrases and oversized words before calling Google", async () => {
    expect(await translate("two words")).toBeNull();
    expect(await translate("a".repeat(81))).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([403, 429, 500])(
    "handles Google status %s without exposing its payload or caching failures",
    async status => {
      fetchMock.mockResolvedValue({
        ok: false,
        status,
        json: async () => ({ error: "test-only-google-key" }),
      });
      await expect(translate("reluctant")).rejects.toMatchObject({
        statusCode: status === 429 ? 503 : 502,
      });
      fetchMock.mockResolvedValue(success());
      expect((await translate("reluctant"))?.source).toBe("Google Translate");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
  );
  it("sanitizes network and timeout errors", async () => {
    fetchMock.mockRejectedValue(new Error("Network failure with test-only-google-key"));
    await expect(translate("reluctant")).rejects.toMatchObject({
      statusCode: 502,
      message: "Google Translate could not be reached. Try again.",
    });
  });
  it("rejects malformed successful responses", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: {} }) });
    await expect(translate("reluctant")).rejects.toMatchObject({ statusCode: 502 });
  });
});
