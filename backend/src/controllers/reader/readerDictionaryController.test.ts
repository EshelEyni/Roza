import express from "express";
import request from "supertest";
import { lookupReaderDictionary } from "./readerDictionaryController";
import { ReaderLookupModel, ReaderVocabularyModel } from "../../models/reader/readerVocabularyModel";
import { lookupReaderWordWithTranslation } from "../../services/reader/readerDictionaryService";

let mockUser = "507f1f77bcf86cd799439011";
jest.mock("../../services/ALSService", () => ({ getLoggedInUserIdFromReq: () => mockUser }));
jest.mock("../../models/reader/readerBookModel", () => ({ ReaderBookModel: { exists: async () => true } }));
jest.mock("../../models/reader/readerVocabularyModel", () => ({
  ReaderLookupModel: { updateOne: jest.fn(), findOne: jest.fn(), countDocuments: jest.fn() },
  ReaderVocabularyModel: { updateOne: jest.fn(), findOne: jest.fn() },
}));
jest.mock("../../services/reader/readerDictionaryService", () => ({
  normalizeReaderWord: (word: string) => word.trim().toLowerCase(),
  lookupReaderWordWithTranslation: jest.fn(),
}));
const app = express();
app.use(express.json());
app.post("/:id", lookupReaderDictionary);
const book = "507f191e810c19729de860ea";
const entry = { word: "countenanced", headword: "countenance", senses: [] };
let events: Map<string, any>;
let historicalCount: number;
const lookup = (body = {}, bookId = book) => request(app).post("/" + bookId).send({
  word: "countenanced", requestId: "lookup-request-123456", location: "epubcfi(/6/2!/4/2:20)",
  pageLocation: "epubcfi(/6/2!/4/2:0)", ...body,
});
beforeEach(() => {
  jest.clearAllMocks();
  events = new Map(); historicalCount = 7;
  mockUser = "507f1f77bcf86cd799439011";
  (lookupReaderWordWithTranslation as jest.Mock).mockImplementation(async word => ({ ...entry, word: word.toLowerCase() }));
  (ReaderLookupModel.updateOne as jest.Mock).mockImplementation(async (identity, update) => {
    if (!events.has(identity.requestId)) events.set(identity.requestId, { ...update.$setOnInsert, createdAt: new Date() });
  });
  (ReaderLookupModel.findOne as jest.Mock).mockImplementation(identity => ({ orFail: async () => events.get(identity.requestId) }));
  (ReaderLookupModel.countDocuments as jest.Mock).mockImplementation(async () => historicalCount + events.size);
  (ReaderVocabularyModel.updateOne as jest.Mock).mockResolvedValue({});
  (ReaderVocabularyModel.findOne as jest.Mock).mockImplementation(() => ({ orFail: async () => ({ lookupCount: historicalCount + events.size }) }));
});
test("reopen, provider switch, and simultaneous requests share one atomic event", async () => {
  const responses = await Promise.all([
    lookup(), lookup({ requestId: "different-request-12345", provider: "google" }),
    lookup({ word: "COUNTENANCED", location: "epubcfi(/6/2!/4/2:60)" }),
  ]);
  expect(responses.every(response => response.status === 200)).toBe(true);
  expect(events.size).toBe(1);
  expect((await lookup()).body.data.lookupCount).toBe(8);
  expect(ReaderLookupModel.updateOne).toHaveBeenCalledWith(expect.anything(), expect.anything(), { upsert: true });
});
test("another page, word, book, or user each counts separately", async () => {
  await lookup();
  await lookup({ pageLocation: "epubcfi(/6/2!/4/4:0)" });
  await lookup({ word: "another" });
  await lookup({}, "507f191e810c19729de860eb");
  mockUser = "507f1f77bcf86cd799439012";
  await lookup();
  expect(events.size).toBe(5);
});
test("vocabulary write failure preserves the translation", async () => {
  (ReaderVocabularyModel.updateOne as jest.Mock).mockRejectedValue(new Error("database unavailable"));
  const response = await lookup();
  expect(response.status).toBe(200);
  expect(response.body.data.entry.word).toBe(entry.word);
  expect(response.body.data.lookupCount).toBeUndefined();
});
test("a stalled vocabulary write cannot hold the translation indefinitely", async () => {
  (ReaderVocabularyModel.updateOne as jest.Mock).mockImplementation(() => new Promise(() => {}));
  const response = await lookup();
  expect(response.status).toBe(200);
  expect(response.body.data.entry.word).toBe(entry.word);
}, 5000);
