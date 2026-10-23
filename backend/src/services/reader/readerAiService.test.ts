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
      max_output_tokens: 1200,
    });
  });
  it("does not present incomplete or empty answers as successful", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "incomplete",
        output: [{ type: "message", content: [{ type: "output_text", text: "Partial" }] }],
      }),
    });
    await expect(askReaderAi("", [])).rejects.toThrow("could not complete");
  });
  it("returns actionable errors without exposing provider details or keys", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 429 });
    await expect(askReaderAi("", [])).rejects.toThrow("usage limit");
    delete process.env.OPENAI_API_KEY;
    await expect(askReaderAi("", [])).rejects.toThrow("not configured");
  });
});
