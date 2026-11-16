import express, { Request, Response, NextFunction } from "express";
import request from "supertest";
import { ReaderBookModel } from "../../models/reader/readerBookModel";
import { generateReaderSpeech, readerSpeechWav } from "../../services/reader/readerSpeechProvider";
import { readerSpeechLimits, readerSpeechPreviewText } from "../../services/reader/readerSpeechConfig";
import { AppError } from "../../services/error/errorService";
import { alignReaderSpeech } from "../../services/reader/readerSpeechAlignment";
jest.mock("../../services/reader/readerSpeechAlignment", () => ({ alignReaderSpeech: jest.fn() }));
import readerRouter from "./readerRouter";

let mockUser = "507f1f77bcf86cd799439011";
const owner = "507f1f77bcf86cd799439011",
  bookId = "507f191e810c19729de860ea";
let sourceText = "Hello world.",
  edition = 0;
let narrator: { engine: string; voice: string; name: string; lang: string } | undefined;
jest.mock("../../services/ALSService", () => ({ getLoggedInUserIdFromReq: () => mockUser }));
jest.mock("../../middlewares/authGuards/authGuardsMiddleware", () => ({
  checkUserAuthentication: (req: Request, res: Response, next: NextFunction) =>
    req.headers.authorization ? next() : res.status(401).json({ status: "fail" }),
}));
jest.mock("../../models/reader/readerBookModel", () => ({
  ReaderBookModel: { findOne: jest.fn(), findOneAndUpdate: jest.fn() },
}));
jest.mock("../../services/reader/readerSpeechProvider", () => {
  const actual = jest.requireActual("../../services/reader/readerSpeechProvider");
  return { ...actual, generateReaderSpeech: jest.fn() };
});
jest.mock("../../services/reader/readerStorageService", () => ({
  getReaderBucket: () => ({
    openDownloadStream: () => ({
      toArray: async () => {
        const zip = new (require("adm-zip"))();
        zip.addFile(
          "META-INF/container.xml",
          Buffer.from(
            '<container><rootfiles><rootfile full-path="book.opf"/></rootfiles></container>',
          ),
        );
        zip.addFile(
          "book.opf",
          Buffer.from(
            '<package><manifest><item id="a" href="a.xhtml"/></manifest><spine><itemref idref="a"/></spine></package>',
          ),
        );
        zip.addFile(
          "a.xhtml",
          Buffer.from("<html><head/><body><p>" + sourceText + "</p></body></html>"),
        );
        return [zip.toBuffer()];
      },
    }),
  }),
}));
const app = express();
app.use(express.json());
app.use("/api/reader", readerRouter);
app.use((error: AppError, _req: Request, res: Response, _next: NextFunction) =>
  res.status(error.statusCode || 500).json({ status: "fail", message: error.message }),
);
const base = "/api/reader/" + bookId + "/audiobook";
const body = () => ({
  requestId: "request-id-123456789",
  passageCfi: "epubcfi(/6/2!/4/2,/1:0,/1:" + sourceText.length + ")",
  voice: "marin",
});
const post = (data: object = body()) =>
  request(app)
    .post(base + "/chunks")
    .set("Authorization", "test")
    .send(data);
const get = (url: string) => request(app).get(url).set("Authorization", "test");
function binary(url: string, range?: string) {
  let req = get(url);
  if (range) req = req.set("Range", range);
  return req.buffer(true).parse((res, done) => {
    const chunks: Buffer[] = [];
    res.on("data", chunk => chunks.push(Buffer.from(chunk)));
    res.on("end", () => done(null, Buffer.concat(chunks)));
  });
}
describe("backend-only audiobook API", () => {
  const environment = { ...process.env };
  beforeEach(() => {
    jest.clearAllMocks();
    sourceText = "Hello world.";
    narrator = undefined;
    mockUser = owner;
    edition++;
    process.env.READER_ENABLED = "true";
    process.env.READER_ALLOWED_USER_IDS = owner;
    process.env.READER_AUDIOBOOK_ENABLED = "true";
    process.env.OPENAI_API_KEY = "test-only-secret";
    delete process.env.READER_AUDIOBOOK_MODEL;
    delete process.env.READER_AUDIOBOOK_OPENAI_API_KEY;
    delete process.env.READER_AUDIOBOOK_WORD_TIMINGS;
    (alignReaderSpeech as jest.Mock).mockResolvedValue(null);
    (ReaderBookModel.findOne as jest.Mock).mockImplementation(filter => ({
      select: jest.fn().mockResolvedValue(
        String(filter._id) === bookId && filter.userId === owner
          ? {
              _id: bookId,
              audiobookNarrator: narrator,
              fileId: ("000000000000000000000000" + edition.toString(16)).slice(-24),
            }
          : null,
      ),
    }));
    (ReaderBookModel.findOneAndUpdate as jest.Mock).mockImplementation(async (_filter, update) => {
      narrator = update.$set.audiobookNarrator;
      return { audiobookNarrator: narrator };
    });
    (generateReaderSpeech as jest.Mock).mockImplementation(async ({ text }) => ({
      wav: readerSpeechWav(Buffer.alloc(4800, 1)),
      transcript: text,
      durationSeconds: 0.1,
    }));
  });
  afterEach(() => {
    process.env = { ...environment };
  });
  it("requires authentication, reader access and ownership for every endpoint", async () => {
    expect((await request(app).get(base + "/config")).status).toBe(401);
    process.env.READER_ENABLED = "false";
    expect((await get(base + "/config")).status).toBe(403);
    process.env.READER_ENABLED = "true";
    mockUser = "507f1f77bcf86cd799439012";
    process.env.READER_ALLOWED_USER_IDS = mockUser;
    expect((await get(base + "/config")).status).toBe(404);
    expect((await post()).status).toBe(404);
    expect((await get(base + "/chunks/" + "a".repeat(64))).status).toBe(404);
    expect(
      (
        await request(app)
          .delete(base + "/requests/request-id-123456789")
          .set("Authorization", "test")
      ).status,
    ).toBe(404);
    expect(generateReaderSpeech).not.toHaveBeenCalled();
  });
  it("reports capabilities without provider calls or credentials and is disabled by default", async () => {
    delete process.env.READER_AUDIOBOOK_ENABLED;
    let response = await get(base + "/config");
    expect(response.body.data).toMatchObject({
      enabled: false,
      available: false,
      unavailableReason: "disabled",
      wordTimings: true,
    });
    expect((await post()).status).toBe(503);
    process.env.READER_AUDIOBOOK_ENABLED = "true";
    delete process.env.OPENAI_API_KEY;
    response = await get(base + "/config");
    expect(response.body.data).toMatchObject({
      available: false,
      unavailableReason: "not_configured",
    });
    expect((await post()).status).toBe(503);
    process.env.OPENAI_API_KEY = "test-only-secret";
    response = await get(base + "/config");
    expect(response.body.data).toMatchObject({
      available: true,
      model: "gpt-realtime-2.1-mini",
      defaultVoice: "marin",
      maxChars: 600,
      wordTimings: true,
      requiresAiVoiceDisclosure: true,
    });
    expect(response.body.data.voices).toHaveLength(10);
    expect(JSON.stringify(response.body)).not.toContain("test-only-secret");
    expect(generateReaderSpeech).not.toHaveBeenCalled();
  });
  it("saves the narrator on the owned book without replacing reading progress", async () => {
    process.env.READER_AUDIOBOOK_ENABLED = "false";
    const choice = { engine: "system", voice: "device-alex", name: "Alex", lang: "en-GB" };
    const response = await request(app).patch(base + "/narrator").set("Authorization", "test").send(choice);
    expect(response.status).toBe(200);
    expect(ReaderBookModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: bookId, userId: owner }, { $set: { audiobookNarrator: choice } }, { new: true, runValidators: true },
    );
    expect((await get(base + "/config")).body.data.narrator).toEqual(choice);
    expect(generateReaderSpeech).not.toHaveBeenCalled();
  });
  it.each([
    {engine:"other",voice:"marin",name:"Marin",lang:""},
    {engine:"openai",voice:"unknown",name:"Unknown",lang:""},
    {engine:"system",voice:"",name:"Alex",lang:"en"},
    {engine:"system",voice:"alex",name:"x".repeat(257),lang:"en"},
    {engine:"system",voice:"alex",name:"Alex",lang:"en",userId:owner},
  ])("rejects invalid narrator settings %j", async choice => {
    expect((await request(app).patch(base + "/narrator").set("Authorization", "test").send(choice)).status).toBe(400);
    expect(ReaderBookModel.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it("generates the fixed shared preview text, caches audio, and forbids supplied text", async () => {
    const preview = (data: object) => request(app).post(base + "/preview").set("Authorization", "test").send(data);
    expect((await get(base + "/config")).body.data.previewText).toBe(readerSpeechPreviewText);
    const response = await preview({requestId:"voice-preview-123456",voice:"cedar"});
    expect(response.status).toBe(201);
    expect(response.body.data.text).toBe(readerSpeechPreviewText);
    expect(generateReaderSpeech).toHaveBeenCalledWith(
      {text:readerSpeechPreviewText,voice:"cedar",userId:owner}, expect.objectContaining({signal:expect.anything()}),
    );
    expect((await binary(response.body.data.audioUrl)).body.toString("ascii",0,4)).toBe("RIFF");
    expect((await preview({requestId:"voice-preview-123457",voice:"cedar"})).status).toBe(200);
    expect(generateReaderSpeech).toHaveBeenCalledTimes(1);
    expect((await preview({requestId:"voice-preview-123458",voice:"cedar",text:"arbitrary"})).status).toBe(400);
    expect((await preview({requestId:"voice-preview-123459",voice:"other"})).status).toBe(400);
    expect(generateReaderSpeech).toHaveBeenCalledTimes(1);
    expect(alignReaderSpeech).not.toHaveBeenCalled();
  });
  it("caches word timings with audio and returns exact source offsets", async () => {
    const words = [{startChar:0,endChar:5,startSeconds:0.01,endSeconds:0.04},{startChar:6,endChar:12,startSeconds:0.05,endSeconds:0.09}];
    (alignReaderSpeech as jest.Mock).mockResolvedValue(words);
    const response = await post();
    expect(response.status).toBe(201);
    expect(response.body.data.alignment).toMatchObject({type:"word",source:"whisper-1",wordTimings:words});
    expect((await post()).body.data.alignment.wordTimings).toEqual(words);
    expect(alignReaderSpeech).toHaveBeenCalledTimes(1);
  });
  it("can disable timing without the extra provider call", async () => {
    process.env.READER_AUDIOBOOK_WORD_TIMINGS = "false";
    expect((await get(base+"/config")).body.data.wordTimings).toBe(false);
    expect((await post()).body.data.alignment).toMatchObject({type:"passage",wordTimings:null});
    expect(alignReaderSpeech).not.toHaveBeenCalled();
  });
  it("cancels an alignment in progress without caching incomplete work", async () => {
    let began!: () => void;
    const started = new Promise<void>(resolve => { began=resolve; });
    (alignReaderSpeech as jest.Mock).mockImplementation((_text,_wav,_duration,_key,signal) => new Promise(resolve => {
      signal.addEventListener("abort",()=>resolve(null),{once:true}); began();
    }));
    const pending = post().then(response=>response);
    await started;
    expect((await request(app).delete(base+"/requests/"+body().requestId).set("Authorization","test")).status).toBe(204);
    expect((await pending).status).toBe(499);
    (alignReaderSpeech as jest.Mock).mockResolvedValue(null);
    const retry = await post(); expect(retry.status).toBe(201);
    expect(retry.body.data.cacheHit).toBe(false);
    expect(generateReaderSpeech).toHaveBeenCalledTimes(2);
  });
  it("guards preview generation and narrator writes with authentication and ownership", async () => {
    expect((await request(app).post(base+"/preview").send({})).status).toBe(401);
    expect((await request(app).patch(base+"/narrator").send({})).status).toBe(401);
    mockUser = "507f1f77bcf86cd799439012"; process.env.READER_ALLOWED_USER_IDS = mockUser;
    expect((await request(app).post(base+"/preview").set("Authorization","test").send({})).status).toBe(404);
    expect((await request(app).patch(base+"/narrator").set("Authorization","test").send({})).status).toBe(404);
    expect(ReaderBookModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(generateReaderSpeech).not.toHaveBeenCalled();
  });
  it("derives speech from the owned EPUB and returns an authenticated audio URL", async () => {
    const response = await post();
    expect(response.status).toBe(201);
    expect(ReaderBookModel.findOne).toHaveBeenCalledWith({ _id: bookId, userId: owner });
    expect(generateReaderSpeech).toHaveBeenCalledWith(
      { text: sourceText, voice: "marin", userId: owner },
      expect.objectContaining({
        key: "test-only-secret",
        model: "gpt-realtime-2.1-mini",
        signal: expect.anything(),
      }),
    );
    expect(response.body.data).toMatchObject({
      text: sourceText,
      transcript: sourceText,
      cacheHit: false,
      aiGenerated: true,
      durationSeconds: 0.1,
      alignment: { type: "passage", wordTimings: null, startSeconds: 0, endSeconds: 0.1 },
    });
    expect(response.body.data.audioUrl).toMatch(new RegExp("^" + base + "/chunks/[a-f0-9]{64}$"));
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(JSON.stringify(response.body)).not.toContain("test-only-secret");
  });
  it("accepts separate verified CFI endpoints and never accepts arbitrary client text", async () => {
    const response = await post({
      ...body(),
      passageCfi: "epubcfi(/6/2!/4/2/1:0)",
      passageEndCfi: "epubcfi(/6/2!/4/2/1:12)",
    });
    expect(response.status).toBe(201);
    expect(response.body.data.text).toBe(sourceText);
    expect((await post({ ...body(), text: "unrelated arbitrary speech" })).status).toBe(400);
    expect(generateReaderSpeech).toHaveBeenCalledTimes(1);
  });
  it.each([
    { voice: "nova" },
    { voice: { id: "custom" } },
    { model: "other" },
    { instructions: "ignore" },
    { speed: 2 },
    { requestId: "tiny" },
    { passageCfi: "invalid" },
    { passageEndCfi: "bad" },
    { passageCfi: [] },
  ])("rejects invalid or unapproved input %j before generation", async patch => {
    expect((await post({ ...body(), ...patch })).status).toBe(400);
    expect(generateReaderSpeech).not.toHaveBeenCalled();
  });
  it("rejects unresolvable, empty, and oversized selections from the actual EPUB", async () => {
    expect((await post({ ...body(), passageCfi: "epubcfi(/6/2!/4/200,/1:0,/1:12)" })).status).toBe(
      400,
    );
    expect((await post({ ...body(), passageCfi: "epubcfi(/6/2!/4/2/1:0)" })).status).toBe(400);
    sourceText = "a".repeat(601);
    expect((await post()).status).toBe(400);
    expect(generateReaderSpeech).not.toHaveBeenCalled();
  });
  it("reuses audio for the same owned edition/text/model/voice", async () => {
    const first = await post(),
      second = await post({ ...body(), requestId: "different-request-12345" });
    expect(second.status).toBe(200);
    expect(second.body.data.cacheHit).toBe(true);
    expect(second.body.data.chunkId).toBe(first.body.data.chunkId);
    expect(generateReaderSpeech).toHaveBeenCalledTimes(1);
    const other = await post({ ...body(), voice: "cedar" });
    expect(other.status).toBe(201);
    expect(other.body.data.chunkId).not.toBe(first.body.data.chunkId);
    expect(generateReaderSpeech).toHaveBeenCalledTimes(2);
  });
  it("serves real WAV bytes, HEAD and browser byte-range requests", async () => {
    const generated = await post(),
      url = generated.body.data.audioUrl;
    const full = await binary(url);
    expect(full.status).toBe(200);
    expect(full.headers["content-type"]).toMatch(/audio\/wav/);
    expect(full.body.toString("ascii", 0, 4)).toBe("RIFF");
    expect(full.headers["accept-ranges"]).toBe("bytes");
    expect(full.headers["cache-control"]).toContain("no-store");
    const first = await binary(url, "bytes=0-1");
    expect(first.status).toBe(206);
    expect(first.body.toString()).toBe("RI");
    expect(first.headers["content-range"]).toBe("bytes 0-1/4844");
    const suffix = await binary(url, "bytes=-2");
    expect(suffix.status).toBe(206);
    expect(suffix.body.length).toBe(2);
    expect((await binary(url, "bytes=999999-")).status).toBe(416);
    expect((await binary(url, "bytes=0-1,4-5")).status).toBe(416);
    expect((await binary(url, "bytes=-0")).status).toBe(416);
    const head = await request(app).head(url).set("Authorization", "test");
    expect(head.status).toBe(200);
    expect(head.headers["content-length"]).toBe("4844");
    expect(generateReaderSpeech).toHaveBeenCalledTimes(1);
  });
  it("rejects audio after edition changes, ownership loss or cache expiry", async () => {
    const generated = await post(),
      url = generated.body.data.audioUrl;
    edition++;
    expect((await get(url)).status).toBe(410);
    edition--;
    const now = Date.now(),
      clock = jest.spyOn(Date, "now").mockReturnValue(now + readerSpeechLimits.cacheTtlMs + 1);
    try {
      expect((await get(url)).status).toBe(410);
    } finally {
      clock.mockRestore();
    }
    (ReaderBookModel.findOne as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });
    expect((await get(url)).status).toBe(404);
  });
  it("cancels only the requested generation and releases its slot after an error", async () => {
    let signal: AbortSignal;
    let started!: () => void;
    const ready = new Promise<void>(resolve => {
      started = resolve;
    });
    (generateReaderSpeech as jest.Mock).mockImplementationOnce(
      (_input, options) =>
        new Promise((_resolve, reject) => {
          signal = options.signal;
          signal.addEventListener(
            "abort",
            () => reject(new AppError("Audiobook narration cancelled.", 499)),
            { once: true },
          );
          started();
        }),
    );
    const pending = post().then(response => response);
    await ready;
    const duplicate = await post({ ...body(), requestId: "second-request-12345" });
    expect(duplicate.status).toBe(409);
    expect(duplicate.headers["retry-after"]).toBe("1");
    await request(app)
      .delete(base + "/requests/wrong-request-123456")
      .set("Authorization", "test");
    expect(signal!.aborted).toBe(false);
    process.env.READER_AUDIOBOOK_ENABLED = "false";
    expect(
      (
        await request(app)
          .delete(base + "/requests/" + body().requestId)
          .set("Authorization", "test")
      ).status,
    ).toBe(204);
    expect((await pending).status).toBe(499);
    expect(signal!.aborted).toBe(true);
    process.env.READER_AUDIOBOOK_ENABLED = "true";
    expect((await post()).status).toBe(201);
  });
  it("aborts upstream work when the requesting HTTP client disconnects", async () => {
    let started!: () => void, aborted!: () => void;
    const ready = new Promise<void>(resolve => {
        started = resolve;
      }),
      cancelled = new Promise<void>(resolve => {
        aborted = resolve;
      });
    (generateReaderSpeech as jest.Mock).mockImplementationOnce(
      (_input, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener(
            "abort",
            () => {
              aborted();
              reject(new AppError("cancelled", 499));
            },
            { once: true },
          );
          started();
        }),
    );
    const server = app.listen(0, "127.0.0.1");
    try {
      const req = request(server)
        .post(base + "/chunks")
        .set("Authorization", "test")
        .send(body());
      const pending = req.then(
        () => undefined,
        () => undefined,
      );
      await ready;
      req.abort();
      await cancelled;
      await pending;
      await new Promise<void>(resolve => setImmediate(resolve));
      expect((await post()).status).toBe(201);
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
  it("discards a provider result that finishes after explicit cancellation", async () => {
    let started!: () => void;
    let complete!: (value: unknown) => void;
    const ready = new Promise<void>(resolve => {
      started = resolve;
    });
    (generateReaderSpeech as jest.Mock).mockImplementationOnce(
      () =>
        new Promise(resolve => {
          complete = resolve;
          started();
        }),
    );
    const pending = post().then(response => response);
    await ready;
    await request(app)
      .delete(base + "/requests/" + body().requestId)
      .set("Authorization", "test");
    complete({
      wav: readerSpeechWav(Buffer.alloc(4800, 1)),
      transcript: sourceText,
      durationSeconds: 0.1,
    });
    expect((await pending).status).toBe(499);
    expect((await post()).status).toBe(201);
    expect(generateReaderSpeech).toHaveBeenCalledTimes(2);
  });
  it("does not cache failed provider requests and returns safe status messages", async () => {
    (generateReaderSpeech as jest.Mock).mockRejectedValueOnce(
      new AppError("OpenAI audiobook quota is exhausted.", 429),
    );
    const response = await post();
    expect(response.status).toBe(429);
    expect(response.headers["retry-after"]).toBe("60");
    expect((await post()).status).toBe(201);
    expect(generateReaderSpeech).toHaveBeenCalledTimes(2);
  });
});
