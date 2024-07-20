import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import router from "./reviewRouter";
import { errorHandler } from "../../services/error/errorService";
import { connectToTestDB, disconnectFromTestDB } from "../../services/test/testDBService";
import setupAsyncLocalStorage from "../../middlewares/setupALS/setupALSMiddleware";
import {
  createTestBookReview,
  createTestBookReviews,
  getMongoId,
} from "../../services/test/testUtilService";
import { assertBookReview } from "../../services/test/testAssertionService";
import { BookReviewModel } from "../../models/review/reviewModel";

const app = express();
app.use(cookieParser());
app.use(express.json());
app.all("*", setupAsyncLocalStorage);
app.use(router);
app.use(errorHandler);

jest.mock("../../services/rateLimiterService", () => ({
  authRequestLimiter: jest.fn().mockImplementation((req, res, next) => next()),
}));

describe("Review Router", () => {
  const userId = getMongoId();
  beforeAll(async () => {
    await connectToTestDB();
    await BookReviewModel.insertMany(
      createTestBookReviews({
        num: 5,
        userId,
      }),
    );
  });

  afterAll(async () => {
    await BookReviewModel.deleteMany({});
    await disconnectFromTestDB();
  });

  it("should get all reviews", async () => {
    const response = await request(app).get("/");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.results).toBeGreaterThan(0);
    const books = response.body.data;
    books.forEach(assertBookReview);
  });

  it("should get a review by id", async () => {
    const book = await BookReviewModel.create(createTestBookReview());
    const { id } = book;
    const response = await request(app).get(`/${id}`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");

    const responseBook = response.body.data;
    assertBookReview(responseBook);
  });

  it("should add a review", async () => {
    const newBook = createTestBookReview();
    const response = await request(app).post("/").send(newBook);

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("success");
  });

  it("should update a review", async () => {
    const book = await BookReviewModel.create(createTestBookReview());
    const { id } = book;
    const response = await request(app).patch(`/${id}`).send({ title: "new title" });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });
});
