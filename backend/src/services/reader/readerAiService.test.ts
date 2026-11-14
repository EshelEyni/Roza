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

describe("Writing edit provider limits", () => {
  const originalFetch = global.fetch;
  beforeEach(() => { process.env.OPENAI_API_KEY = "test-key-not-real"; global.fetch = jest.fn(); });
  afterEach(() => { global.fetch = originalFetch; delete process.env.OPENAI_API_KEY; });
  it("preserves whitespace and bounds edit output without changing chat defaults", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ok:true,json:async()=>({status:"completed",output:[{type:"message",content:[{type:"output_text",text:"  שלום עולם.\n"}]}]})});
    expect(await askReaderAi("Copy edit", [{role:"user",content:"  שלום עולם.\n"}], "gpt-4.1-mini", "edit", 1200)).toBe("  שלום עולם.\n");
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).max_output_tokens).toBe(1200);
    await askReaderAi("Copy edit",[],"gpt-4.1-mini","edit",999999);
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body).max_output_tokens).toBe(16000);
  });
  it("rejects refusals and incomplete edits instead of returning replacement text", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ok:true,json:async()=>({status:"completed",output:[{type:"message",content:[{type:"refusal",refusal:"Declined"}]}]})});
    await expect(askReaderAi("Copy edit",[],"default","edit")).rejects.toThrow("declined");
    (global.fetch as jest.Mock).mockResolvedValueOnce({ok:true,json:async()=>({status:"incomplete",incomplete_details:{reason:"max_output_tokens"},output:[]})});
    await expect(askReaderAi("Copy edit",[],"default","edit")).rejects.toThrow("before finishing");
  });
});

describe("Bounded book tool orchestration", () => {
  const originalFetch = global.fetch;
  const definitions = [{ type: "function" as const, name: "read", description: "Read", strict: true,
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false } }];
  const answer = { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "Grounded answer" }] }] };
  const call = (name = "read", args = "{}") => ({ status: "completed", output: [
    { type: "reasoning", id: "reason1", encrypted_content: "encrypted-reasoning" },
    { type: "function_call", call_id: "call1", name, arguments: args },
  ] });
  const response = (data: unknown) => ({ ok: true, json: async () => data });
  beforeEach(() => { process.env.OPENAI_API_KEY = "mock-only"; global.fetch = jest.fn(); });
  afterEach(() => { global.fetch = originalFetch; delete process.env.OPENAI_API_KEY; jest.useRealTimers(); });
  it("passes function outputs and reasoning through stateless continuation", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(response(call())).mockResolvedValueOnce(response(answer));
    const execute = jest.fn(() => ({ text: "book evidence" }));
    expect(await askReaderAi("", [], "gpt-6.1-terra", "answer", 4000, { definitions, execute })).toBe("Grounded answer");
    expect(execute).toHaveBeenCalledWith("read", {});
    const payload = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
    expect(payload.input[0]).toMatchObject({ type: "reasoning", encrypted_content: "encrypted-reasoning" });
    expect(payload.input[2]).toMatchObject({ type: "function_call_output", call_id: "call1", output: JSON.stringify({ text: "book evidence" }) });
    expect(payload.include).toEqual(["reasoning.encrypted_content"]);
    expect(payload.parallel_tool_calls).toBe(false);
    expect(payload.store).toBe(false);
  });
  it.each([["unknown", "{}"], ["read", "{invalid"]])("rejects unsafe tool dispatch %s/%s without executing", async (name, args) => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(response(call(name, args))).mockResolvedValueOnce(response(answer));
    const execute = jest.fn();
    await askReaderAi("", [], "default", "answer", 4000, { definitions, execute });
    expect(execute).not.toHaveBeenCalled();
    const payload = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
    expect(JSON.parse(payload.input[2].output)).toHaveProperty("error");
  });
  it("forces a final answer after twelve tool calls", async () => {
    (global.fetch as jest.Mock).mockImplementation(async (_url: string, init: { body: string }) =>
      response(JSON.parse(init.body).tool_choice === "none" ? answer : call()));
    const execute = jest.fn(() => ({ text: "short" }));
    await askReaderAi("", [], "default", "answer", 4000, { definitions, execute });
    expect(execute).toHaveBeenCalledTimes(12);
    expect(global.fetch).toHaveBeenCalledTimes(13);
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[12][1].body).tool_choice).toBe("none");
  });
  it("substitutes a budget error for oversized tool output and requests a final answer", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(response(call())).mockResolvedValueOnce(response(answer));
    await askReaderAi("", [], "default", "answer", 4000, { definitions, execute: () => ({ text: "א".repeat(200000) }) });
    const calls = (global.fetch as jest.Mock).mock.calls;
    const payload = JSON.parse(calls[1][1].body);
    expect(payload.tool_choice).toBe("none");
    expect(JSON.parse(payload.input[2].output).error).toContain("Context budget");
    expect(calls.every((entry: unknown[]) => Buffer.byteLength((entry[1] as { body: string }).body) <= 240000)).toBe(true);
  });
  it("shares one deadline across all tool rounds", async () => {
    jest.useFakeTimers();
    (global.fetch as jest.Mock).mockImplementationOnce(async () => {
      jest.advanceTimersByTime(70000); return response(call());
    }).mockImplementationOnce(async (_url: string, init: { signal: AbortSignal }) => {
      jest.advanceTimersByTime(50001);
      expect(init.signal.aborted).toBe(true);
      throw new Error("abort");
    });
    await expect(askReaderAi("", [], "default", "answer", 4000, { definitions, execute: () => ({}) })).rejects.toThrow("120 seconds");
  });
  it("does not expose book tools to summary or editing requests", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(response(answer));
    const tools = { definitions, execute: jest.fn() };
    await askReaderAi("", [], "default", "summary", 4000, tools);
    await askReaderAi("", [], "default", "edit", 4000, tools);
    for (const args of (global.fetch as jest.Mock).mock.calls) expect(JSON.parse(args[1].body).tools).toBeUndefined();
    expect(tools.execute).not.toHaveBeenCalled();
  });
});
