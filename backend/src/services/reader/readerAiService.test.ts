import { askReaderAi } from "./readerAiService";

describe("Reader AI provider", () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key-not-real";
    global.fetch = jest.fn();
  });
  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.OPENAI_API_KEY;
    delete process.env.READER_AI_MODEL;
  });
  it("keeps provider storage off and caps output with a configurable model", async () => {
    process.env.READER_AI_MODEL = "test-model";
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "completed",
        output: [
          { type: "reasoning" },
          { type: "message", content: [{ type: "output_text", text: "A useful answer" }] },
        ],
      }),
    });
    expect(
      await askReaderAi("Follow question language", [{ role: "user", content: "Hello" }]),
    ).toBe("A useful answer");
    const [url, request] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(JSON.parse(request.body)).toMatchObject({
      model: "test-model",
      store: false,
      max_output_tokens: 4000,
    });
  });
  it.each(["gpt-4.1-mini", "gpt-6-luna", "gpt-6.1-terra", "gpt-6.1-sol", "gpt-6-astra"] as const)(
    "uses the saved %s selection instead of the environment", async model => {
      process.env.READER_AI_MODEL = "different-server-default";
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ status: "completed", output: [
          { type: "message", content: [{ type: "output_text", text: "Answer" }] },
        ] }),
      });
      await askReaderAi("", [], model);
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.model).toBe(model);
      expect(body.max_output_tokens).toBe(model === "gpt-4.1-mini" ? 4000 : 12000);
      expect(body.reasoning).toEqual(model === "gpt-4.1-mini" ? undefined : { effort: "low" });
    },
  );
  it.each(["gpt-4.1-mini", "gpt-6.1-terra"] as const)("uses bounded summary generation with %s", async model => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({
      status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "Memory" }] }],
    }) });
    await askReaderAi("Summarize", [{ role: "user", content: "Old turns" }], model, "summary");
    const payload = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(payload.model).toBe(model);
    expect(payload.max_output_tokens).toBe(model === "gpt-4.1-mini" ? 1800 : 6000);
    expect(payload.store).toBe(false);
  });
  it("rejects an oversized combined input before calling the provider", async () => {
    await expect(askReaderAi("", [{ role: "user", content: "א".repeat(240001) }])).rejects.toThrow("too large");
    expect(global.fetch).not.toHaveBeenCalled();
  });
  it("does not present incomplete or empty answers as successful", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "incomplete",
        output: [{ type: "message", content: [{ type: "output_text", text: "Partial" }] }],
      }),
    });
    await expect(askReaderAi("", [])).rejects.toThrow("incomplete answer");
  });
  it("returns actionable errors without exposing provider details or keys", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 429 });
    await expect(askReaderAi("", [])).rejects.toThrow("HTTP 429");
    delete process.env.OPENAI_API_KEY;
    await expect(askReaderAi("", [])).rejects.toThrow("not configured");
  });
});

describe("Specific OpenAI error messages", () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key-not-real";
  });
  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.OPENAI_API_KEY;
  });
  it.each([
    [429, "credit_balance_exhausted", "insufficient_quota", "no credits remaining"],
    [429, "insufficient_quota", "insufficient_quota", "quota is exhausted"],
    [429, "rate_limit_exceeded", "requests", "request rate limit"],
    [429, "rate_limit_exceeded", "tokens", "token rate limit"],
    [401, "invalid_api_key", "invalid_request_error", "rejected the API key"],
    [404, "model_not_found", "invalid_request_error", "configured model"],
    [400, "context_length_exceeded", "invalid_request_error", "input limit"],
    [403, "permission_denied", "invalid_request_error", "denied permission"],
    [503, "server_error", "server_error", "server error (HTTP 503)"],
    [429, "unknown", "unknown", "did not supply a recognized error reason"],
  ])("maps HTTP %s / %s to its specific cause", async (status, code, type, message) => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({
        ok: false,
        status,
        json: async () => ({
          error: { code, type, message: "Never expose secret sk-test or book contents" },
        }),
      });
    await expect(askReaderAi("", [])).rejects.toThrow(String(message));
    await expect(askReaderAi("", [])).rejects.not.toThrow("sk-test");
  });
  it.each([
    ["max_output_tokens", "response length limit"],
    ["content_filter", "content filter"],
  ])("explains incomplete responses caused by %s", async (reason, message) => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ status: "incomplete", incomplete_details: { reason } }),
      });
    await expect(askReaderAi("", [])).rejects.toThrow(message);
  });
  it("does not describe malformed JSON as a connection failure", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError("invalid");
      },
    });
    await expect(askReaderAi("", [])).rejects.toThrow("unreadable response");
  });
});
