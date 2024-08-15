import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import router from "./bookReviewRouter";
import { errorHandler } from "../../services/error/errorService";
import { connectToTestDB, disconnectFromTestDB } from "../../services/test/testDBService";
import setupAsyncLocalStorage from "../../middlewares/setupALS/setupALSMiddleware";
import {
  createTestBookReview,
  createTestBookReviews,
  createTestUser,
  getLoginTokenStrForTest,
} from "../../services/test/testUtilService";
import { assertBookReview } from "../../services/test/testAssertionService";
import { BookReviewModel } from "../../models/bookReview/bookReviewModel";
import { User } from "../../../../shared/types/user";

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
  let user: User, token: string;
  beforeAll(async () => {
    await connectToTestDB();
    user = await createTestUser();
    token = getLoginTokenStrForTest(user.id);

    await BookReviewModel.insertMany(
      createTestBookReviews({
        num: 5,
        userId: user.id,
      }),
    );
  });

  afterAll(async () => {
    await BookReviewModel.deleteMany({});
    await disconnectFromTestDB();
  });

  it("should get all reviews", async () => {
    const response = await request(app).get("/").set("Cookie", [token]);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.results).toBeGreaterThan(0);
    const books = response.body.data;
    books.forEach(assertBookReview);
  });

  it("should get a review by id", async () => {
    const book = await BookReviewModel.create(createTestBookReview({ userId: user.id }));
    const { id } = book;
    const response = await request(app).get(`/${id}`).set("Cookie", [token]);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");

    const responseBook = response.body.data;
    assertBookReview(responseBook);
  });

  it("should add a review", async () => {
    const newBook = createTestBookReview();
    const response = await request(app).post("/").send(newBook).set("Cookie", [token]);

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("success");
  });

  it("should update a review", async () => {
    const book = await BookReviewModel.create(createTestBookReview({ userId: user.id }));
    const { id } = book;
    const response = await request(app)
      .patch(`/${id}`)
      .send({ title: "new title" })
      .set("Cookie", [token]);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });
});
