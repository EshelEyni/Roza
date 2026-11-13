import express, { Request, Response, NextFunction } from "express";
import request from "supertest";
import readerRouter from "./readerRouter";
import { ReaderKeyboardSettingsModel } from "../../models/reader/readerKeyboardSettingsModel";

let mockOwner = "507f1f77bcf86cd799439011";
jest.mock("../../services/ALSService", () => ({
  getLoggedInUserIdFromReq: () => mockOwner,
}));
jest.mock("../../middlewares/authGuards/authGuardsMiddleware", () => ({
  checkUserAuthentication: (req: Request, res: Response, next: NextFunction) =>
    req.headers.authorization
      ? next()
      : res.status(401).json({ status: "fail" }),
}));
jest.mock("../../models/reader/readerKeyboardSettingsModel", () => ({
  ReaderKeyboardSettingsModel: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}));
const app = express();
app.use(express.json());
app.use("/api/reader", readerRouter);
app.use(
  (
    error: { statusCode?: number; message: string },
    _req: Request,
    res: Response,
    _next: NextFunction,
  ) =>
    res
      .status(error.statusCode || 500)
      .json({ status: "fail", message: error.message }),
);
const endpoint = "/api/reader/keyboard-settings";
describe("User keyboard settings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOwner = "507f1f77bcf86cd799439011";
    process.env.READER_ENABLED = "true";
    process.env.READER_ALLOWED_USER_IDS = mockOwner;
    (ReaderKeyboardSettingsModel.findOne as jest.Mock).mockResolvedValue(null);
    (
      ReaderKeyboardSettingsModel.findOneAndUpdate as jest.Mock
    ).mockResolvedValue({});
  });
  it("requires authentication and reader access", async () => {
    expect((await request(app).get(endpoint)).status).toBe(401);
    process.env.READER_ENABLED = "false";
    expect(
      (
        await request(app)
          .patch(endpoint)
          .set("Authorization", "test")
          .send({ unit: "words", count: 5 })
      ).status,
    ).toBe(403);
    expect(ReaderKeyboardSettingsModel.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it("defaults to one word and never caches account settings publicly", async () => {
    const response = await request(app)
      .get(endpoint)
      .set("Authorization", "test");
    expect(response.body.data).toEqual({ unit: "words", count: 1 });
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(ReaderKeyboardSettingsModel.findOne).toHaveBeenCalledWith({
      userId: mockOwner,
    });
  });
  it.each(["words", "sentences"])(
    "saves %s for the authenticated account and ignores supplied owners",
    async (unit) => {
      const settings = { unit, count: 5 };
      expect(
        (
          await request(app)
            .patch(endpoint)
            .set("Authorization", "test")
            .send({ ...settings, userId: "other", extra: "ignored" })
        ).body.data,
      ).toEqual(settings);
      expect(ReaderKeyboardSettingsModel.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: mockOwner },
        { $set: settings },
        expect.objectContaining({ upsert: true, runValidators: true }),
      );
      (ReaderKeyboardSettingsModel.findOne as jest.Mock).mockResolvedValue({
        ...settings,
        userId: mockOwner,
      });
      expect(
        (await request(app).get(endpoint).set("Authorization", "test")).body
          .data,
      ).toEqual(settings);
      mockOwner = "507f1f77bcf86cd799439012";
      process.env.READER_ALLOWED_USER_IDS = mockOwner;
      (ReaderKeyboardSettingsModel.findOne as jest.Mock).mockResolvedValue(
        null,
      );
      expect(
        (await request(app).get(endpoint).set("Authorization", "test")).body
          .data,
      ).toEqual({ unit: "words", count: 1 });
      expect(ReaderKeyboardSettingsModel.findOne).toHaveBeenLastCalledWith({
        userId: mockOwner,
      });
    },
  );
  it.each([
    null,
    {},
    { unit: "paragraphs", count: 2 },
    ...[0, -1, 1.5, "5", Number.MAX_SAFE_INTEGER + 1].map((count) => ({
      unit: "words",
      count,
    })),
  ])("rejects invalid settings %p", async (settings) => {
    expect(
      (
        await request(app)
          .patch(endpoint)
          .set("Authorization", "test")
          .send(settings ?? {})
      ).status,
    ).toBe(400);
    expect(ReaderKeyboardSettingsModel.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
