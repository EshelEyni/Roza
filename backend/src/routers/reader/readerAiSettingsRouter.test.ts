import express, { Request, Response, NextFunction } from "express";
import request from "supertest";
import { ReaderAiSettingsModel } from "../../models/reader/readerAiSettingsModel";
import readerRouter from "./readerRouter";

const mockOwner = "507f1f77bcf86cd799439011";
jest.mock("../../services/ALSService", () => ({ getLoggedInUserIdFromReq: () => mockOwner }));
jest.mock("../../middlewares/authGuards/authGuardsMiddleware", () => ({
  checkUserAuthentication: (req: Request, res: Response, next: NextFunction) =>
    req.headers.authorization ? next() : res.status(401).json({ status: "fail" }),
}));
jest.mock("../../models/reader/readerAiSettingsModel", () => ({
  ReaderAiSettingsModel: { findOne: jest.fn(), findOneAndUpdate: jest.fn() },
}));
const app = express();
app.use(express.json());
app.use("/api/reader", readerRouter);
app.use(
  (
    err: { statusCode?: number; message: string },
    _req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    res.status(err.statusCode || 500).json({ status: "fail", message: err.message });
  },
);
const defaults = { model: "default", answerLength: "standard", simpleLanguage: true, customInstructions: "" };
describe("Reader AI settings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.READER_ENABLED = "true";
    process.env.READER_ALLOWED_USER_IDS = mockOwner;
    (ReaderAiSettingsModel.findOne as jest.Mock).mockResolvedValue(null);
    (ReaderAiSettingsModel.findOneAndUpdate as jest.Mock).mockResolvedValue({});
  });
  it("requires authentication and reader access", async () => {
    expect((await request(app).get("/api/reader/ai-settings")).status).toBe(401);
    process.env.READER_ENABLED = "false";
    expect(
      (
        await request(app)
          .patch("/api/reader/ai-settings")
          .set("Authorization", "test")
          .send(defaults)
      ).status,
    ).toBe(403);
    expect(ReaderAiSettingsModel.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it("returns adaptive/simple defaults without leaking user data", async () => {
    const result = await request(app).get("/api/reader/ai-settings").set("Authorization", "test");
    expect(result.status).toBe(200);
    expect(result.body.data).toEqual(defaults);
    expect(result.headers["cache-control"]).toBe("no-store");
    expect(ReaderAiSettingsModel.findOne).toHaveBeenCalledWith({ userId: mockOwner });
  });
  it("saves and reopens only the signed-in user's allowed settings", async () => {
    const settings = {
      ...defaults,
      model: "gpt-6.1-terra",
      answerLength: "detailed",
      customInstructions: "Explain metaphors.",
    };
    expect(
      (
        await request(app)
          .patch("/api/reader/ai-settings")
          .set("Authorization", "test")
          .send({ ...settings, userId: "attacker", unexpected: "ignored" })
      ).status,
    ).toBe(200);
    expect(ReaderAiSettingsModel.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: mockOwner },
      { $set: settings },
      expect.objectContaining({ upsert: true, runValidators: true }),
    );
    (ReaderAiSettingsModel.findOne as jest.Mock).mockResolvedValue({
      ...settings,
      userId: "secret-user",
    });
    expect(
      (await request(app).get("/api/reader/ai-settings").set("Authorization", "test")).body.data,
    ).toEqual(settings);
  });
  it("reads legacy saved settings with the server default model", async () => {
    (ReaderAiSettingsModel.findOne as jest.Mock).mockResolvedValue({
      answerLength: "detailed", simpleLanguage: false, customInstructions: "Explain metaphors.",
    });
    const result = await request(app).get("/api/reader/ai-settings").set("Authorization", "test");
    expect(result.body.data.model).toBe("default");
    expect(result.body.data.answerLength).toBe("detailed");
  });
  it("rejects unsupported model IDs before writing", async () => {
    const result = await request(app).patch("/api/reader/ai-settings")
      .set("Authorization", "test").send({ ...defaults, model: "arbitrary-model" });
    expect(result.status).toBe(400);
    expect(ReaderAiSettingsModel.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it("rejects malformed instructions before writing", async () => {
    expect(
      (
        await request(app)
          .patch("/api/reader/ai-settings")
          .set("Authorization", "test")
          .send({ ...defaults, customInstructions: "x".repeat(8001) })
      ).status,
    ).toBe(400);
    expect(ReaderAiSettingsModel.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
