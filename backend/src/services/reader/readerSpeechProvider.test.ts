import { EventEmitter } from "events";
import WebSocket, { WebSocketServer } from "ws";
import { generateReaderSpeech, readerSpeechWav } from "./readerSpeechProvider";

class FakeSocket extends EventEmitter {
  send = jest.fn();
  terminate = jest.fn();
  event(event: unknown) {
    this.emit("message", Buffer.from(JSON.stringify(event)));
  }
}
const input = { text: "Hello world.", voice: "marin" as const, userId: "private-owner" };
function setup(extra: Record<string, unknown> = {}) {
  const socket = new FakeSocket(),
    abort = new AbortController();
  const connect = jest.fn(() => socket as unknown as WebSocket);
  const promise = generateReaderSpeech(
    input,
    { key: "secret-key", model: "gpt-realtime-2.1-mini", signal: abort.signal, ...extra },
    connect,
  );
  return { socket, abort, connect, promise };
}
function start(socket: FakeSocket) {
  socket.event({ type: "session.created" });
  socket.event({
    type: "session.updated",
    session: { audio: { output: { format: { type: "audio/pcm", rate: 24000 }, voice: "marin" } } },
  });
  socket.event({ type: "response.created", response: { id: "response-one" } });
}
function audio(socket: FakeSocket, extra: Record<string, unknown> = {}) {
  socket.event({
    type: "response.output_audio.delta",
    response_id: "response-one",
    item_id: "item-one",
    output_index: 0,
    content_index: 0,
    delta: Buffer.alloc(4800, 1).toString("base64"),
    ...extra,
  });
}
function done(socket: FakeSocket, transcript = "Hello world.", status = "completed") {
  socket.event({
    type: "response.done",
    response: {
      id: "response-one",
      status,
      output: [
        {
          id: "item-one",
          type: "message",
          role: "assistant",
          content: [{ type: "output_audio", transcript }],
        },
      ],
    },
  });
}
describe("OpenAI audiobook Realtime adapter", () => {
  it("keeps credentials server-side and creates one bounded out-of-conversation narration", async () => {
    const { socket, promise, connect } = setup();
    start(socket);
    audio(socket);
    done(socket);
    const result = await promise;
    expect(connect.mock.calls[0]).toEqual([
      "wss://api.openai.com/v1/realtime?model=gpt-realtime-2.1-mini",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer secret-key",
          "OpenAI-Safety-Identifier": expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      }),
    ]);
    const events = socket.send.mock.calls.map(call => JSON.parse(call[0]));
    expect(events[0]).toMatchObject({
      type: "session.update",
      session: {
        type: "realtime",
        output_modalities: ["audio"],
        tools: [],
        max_output_tokens: 4096,
        audio: {
          input: { turn_detection: null },
          output: { voice: "marin", speed: 1, format: { type: "audio/pcm", rate: 24000 } },
        },
      },
    });
    expect(events[1]).toMatchObject({
      type: "response.create",
      response: {
        conversation: "none",
        tools: [],
        input: [
          {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: "Hello world." }],
          },
        ],
      },
    });
    expect(JSON.stringify(events)).not.toContain("secret-key");
    expect(result.wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(result.wav.readUInt32LE(24)).toBe(24000);
    expect(result.wav.readUInt32LE(40)).toBe(4800);
    expect(result.durationSeconds).toBe(0.1);
    expect(socket.terminate).toHaveBeenCalledTimes(1);
  });
  it("waits for completed response, not just a transcript or audio-done event", async () => {
    const { socket, promise } = setup();
    start(socket);
    audio(socket);
    let resolved = false;
    void promise.then(() => {
      resolved = true;
    });
    socket.event({
      type: "response.output_audio_transcript.done",
      response_id: "response-one",
      item_id: "item-one",
      output_index: 0,
      content_index: 0,
      transcript: "Hello world.",
    });
    socket.event({ type: "response.output_audio.done" });
    await Promise.resolve();
    expect(resolved).toBe(false);
    done(socket);
    await promise;
    expect(resolved).toBe(true);
  });
  it.each(["Something else.", "Hello world and extra words."])(
    "rejects changed narration %s",
    async transcript => {
      const { socket, promise } = setup();
      const rejected = expect(promise).rejects.toThrow(/did not match/);
      start(socket);
      audio(socket);
      done(socket, transcript);
      await rejected;
    },
  );
  it.each(["cancelled", "failed", "incomplete"])("rejects response state %s", async status => {
    const { socket, promise } = setup();
    const rejected = expect(promise).rejects.toMatchObject({ statusCode: 502 });
    start(socket);
    audio(socket);
    done(socket, input.text, status);
    await rejected;
  });
  it("rejects mismatched audio scopes, format and multiple audio items", async () => {
    const { socket, promise } = setup();
    const rejected = expect(promise).rejects.toThrow(/invalid audiobook/);
    start(socket);
    audio(socket, { item_id: "other-item" });
    audio(socket);
    await rejected;
  });
  it("rejects an unexpected audio format before starting a billable response", async () => {
    const { socket, promise } = setup();
    const rejected = expect(promise).rejects.toThrow(/invalid/);
    socket.event({ type: "session.created" });
    socket.event({
      type: "session.updated",
      session: { audio: { output: { format: { type: "audio/pcmu" }, voice: "marin" } } },
    });
    await rejected;
    expect(socket.send).toHaveBeenCalledTimes(1);
  });
  it("rejects empty, oversized, malformed and incomplete PCM data", async () => {
    for (const delta of [
      "",
      "not base64!",
      Buffer.from([1]).toString("base64"),
      Buffer.alloc(12).toString("base64"),
    ]) {
      const { socket, promise } = setup({ maxPcmBytes: 10 });
      const rejected = expect(promise).rejects.toMatchObject({ statusCode: 502 });
      start(socket);
      audio(socket, { delta });
      done(socket);
      await rejected;
    }
  });
  it("does not issue response.create twice for repeated session events", async () => {
    const { socket, promise } = setup();
    start(socket);
    socket.event({ type: "session.created" });
    socket.event({
      type: "session.updated",
      session: {
        audio: { output: { format: { type: "audio/pcm", rate: 24000 }, voice: "marin" } },
      },
    });
    audio(socket);
    done(socket);
    await promise;
    expect(socket.send).toHaveBeenCalledTimes(2);
  });
  it("cancels promptly and ignores late provider output", async () => {
    const { socket, promise, abort } = setup();
    const rejected = expect(promise).rejects.toMatchObject({ statusCode: 499 });
    start(socket);
    abort.abort();
    audio(socket);
    done(socket);
    await rejected;
    expect(socket.terminate).toHaveBeenCalledTimes(1);
  });
  it("never opens a socket for an already cancelled request", async () => {
    const abort = new AbortController();
    abort.abort();
    const connect = jest.fn();
    await expect(
      generateReaderSpeech(input, { key: "secret", model: "model", signal: abort.signal }, connect),
    ).rejects.toMatchObject({ statusCode: 499 });
    expect(connect).not.toHaveBeenCalled();
  });
  it("times out stalled sessions and closes the transport", async () => {
    jest.useFakeTimers();
    try {
      const { socket, promise } = setup({ timeoutMs: 20 });
      const rejected = expect(promise).rejects.toMatchObject({ statusCode: 504 });
      jest.advanceTimersByTime(21);
      await rejected;
      expect(socket.terminate).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
  it.each([
    ["insufficient_quota", 429],
    ["rate_limit_exceeded", 429],
    ["invalid_api_key", 503],
    ["model_not_found", 503],
    ["unknown", 502],
  ])("sanitizes provider error %s", async (code, statusCode) => {
    const { socket, promise } = setup();
    const captured = promise.catch(error => error);
    socket.event({ type: "error", error: { code, message: "secret-key and PRIVATE_BOOK_TEXT" } });
    const error = await captured;
    expect(error.statusCode).toBe(statusCode);
    expect(error.message).not.toMatch(/secret-key|PRIVATE_BOOK_TEXT/);
  });
  it("maps a rejected HTTP handshake without exposing its response body", async () => {
    const { socket, promise } = setup();
    const rejected = expect(promise).rejects.toMatchObject({ statusCode: 503 });
    const response = { statusCode: 401, resume: jest.fn() };
    socket.emit("unexpected-response", {}, response);
    await rejected;
    expect(response.resume).toHaveBeenCalledTimes(1);
    expect(socket.terminate).toHaveBeenCalledTimes(1);
  });
  it("handles connection errors, invalid JSON and premature closes", async () => {
    for (const event of ["error", "message", "close"]) {
      const { socket, promise } = setup();
      const rejected = expect(promise).rejects.toMatchObject({ statusCode: 502 });
      socket.emit(event, event === "message" ? Buffer.from("not JSON") : new Error("secret-key"));
      await rejected;
    }
  });
  it("produces correct little-endian PCM WAV headers", () => {
    const wav = readerSpeechWav(Buffer.alloc(8));
    expect(wav.length).toBe(52);
    expect(wav.readUInt16LE(22)).toBe(1);
    expect(wav.readUInt16LE(34)).toBe(16);
    expect(wav.readUInt32LE(4)).toBe(44);
  });
});
describe("local WebSocket protocol smoke test", () => {
  it("runs the real ws transport without calling OpenAI", async () => {
    const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
    await new Promise<void>(resolve => server.once("listening", resolve));
    server.on("connection", socket => {
      socket.send(JSON.stringify({ type: "session.created" }));
      socket.on("message", data => {
        const event = JSON.parse(data.toString());
        if (event.type === "session.update")
          socket.send(JSON.stringify({ type: "session.updated", session: event.session }));
        if (event.type === "response.create") {
          socket.send(
            JSON.stringify({ type: "response.created", response: { id: "response-one" } }),
          );
          const fake = new FakeSocket();
          fake.emit = (name: string, bytes: unknown) => {
            if (name === "message") socket.send(bytes as Buffer);
            return true;
          };
          audio(fake);
          done(fake);
        }
      });
    });
    try {
      const address = server.address() as { port: number };
      const result = await generateReaderSpeech(
        input,
        { key: "test-only", model: "gpt-realtime-2.1-mini", signal: new AbortController().signal },
        (_url, options) => new WebSocket("ws://127.0.0.1:" + address.port, options),
      );
      expect(result.durationSeconds).toBe(0.1);
    } finally {
      for (const socket of server.clients) socket.terminate();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});
