import express, { Request, Response, NextFunction } from "express";
import request from "supertest";
import readerRouter from "./readerRouter";
import { ReaderProgressSettingsModel } from "../../models/reader/readerProgressSettingsModel";

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
jest.mock("../../models/reader/readerProgressSettingsModel", () => ({
  ReaderProgressSettingsModel: {
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
const endpoint = "/api/reader/progress-settings";
describe("User progress settings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOwner = "507f1f77bcf86cd799439011";
    process.env.READER_ENABLED = "true";
    process.env.READER_ALLOWED_USER_IDS = mockOwner;
    (ReaderProgressSettingsModel.findOne as jest.Mock).mockResolvedValue(null);
    (
      ReaderProgressSettingsModel.findOneAndUpdate as jest.Mock
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
          .send({ defaultProgressDisplay: "section" })
      ).status,
    ).toBe(403);
    expect(ReaderProgressSettingsModel.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it("defaults to percentage and never caches account settings publicly", async () => {
    const response = await request(app)
      .get(endpoint)
      .set("Authorization", "test");
    expect(response.body.data).toEqual({ defaultProgressDisplay: "percentage" });
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(ReaderProgressSettingsModel.findOne).toHaveBeenCalledWith({
      userId: mockOwner,
    });
  });
  it.each(["percentage", "section", "book"])(
    "saves %s for the authenticated account and ignores supplied owners",
    async (defaultProgressDisplay) => {
      const settings = { defaultProgressDisplay };
      expect(
        (
          await request(app)
            .patch(endpoint)
            .set("Authorization", "test")
            .send({ ...settings, userId: "other", extra: "ignored" })
        ).body.data,
      ).toEqual(settings);
      expect(ReaderProgressSettingsModel.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: mockOwner },
        { $set: settings },
        expect.objectContaining({ upsert: true, runValidators: true }),
      );
      (ReaderProgressSettingsModel.findOne as jest.Mock).mockResolvedValue({
        ...settings,
        userId: mockOwner,
      });
      expect(
        (await request(app).get(endpoint).set("Authorization", "test")).body
          .data,
      ).toEqual(settings);
      mockOwner = "507f1f77bcf86cd799439012";
      process.env.READER_ALLOWED_USER_IDS = mockOwner;
      (ReaderProgressSettingsModel.findOne as jest.Mock).mockResolvedValue(
        null,
      );
      expect(
        (await request(app).get(endpoint).set("Authorization", "test")).body
          .data,
      ).toEqual({ defaultProgressDisplay: "percentage" });
      expect(ReaderProgressSettingsModel.findOne).toHaveBeenLastCalledWith({
        userId: mockOwner,
      });
    },
  );
  it.each([null, {}, { defaultProgressDisplay: "invalid" }, { defaultProgressDisplay: 0 }, { defaultProgressDisplay: null }])("rejects invalid settings %p", async settings => {
    expect((await request(app).patch(endpoint).set("Authorization", "test").send(settings ?? {})).status).toBe(400);
    expect(ReaderProgressSettingsModel.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
