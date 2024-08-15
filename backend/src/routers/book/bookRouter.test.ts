import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import router from "./bookRouter";
import { errorHandler } from "../../services/error/errorService";
import { connectToTestDB, disconnectFromTestDB } from "../../services/test/testDBService";
import setupAsyncLocalStorage from "../../middlewares/setupALS/setupALSMiddleware";
import { BookModel } from "../../models/books/bookModel";
import {
  createTestBook,
  createTestBooks,
  createTestUser,
  getLoginTokenStrForTest,
} from "../../services/test/testUtilService";
import { assertBook } from "../../services/test/testAssertionService";
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

describe("Book Router", () => {
  let user: User, token: string;

  beforeAll(async () => {
    await connectToTestDB();
    user = await createTestUser();
    token = getLoginTokenStrForTest(user.id);
    await BookModel.insertMany(
      createTestBooks({
        num: 5,
        userId: user.id,
      }),
    );
  });

  afterAll(async () => {
    await BookModel.deleteMany({});
    await disconnectFromTestDB();
  });

  it("should get all books", async () => {
    const response = await request(app).get("/").set("Cookie", [token]);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.results).toBeGreaterThan(0);
    const books = response.body.data;
    books.forEach(assertBook);
  });

  it("should get a book by id", async () => {
    const book = await BookModel.create(
      createTestBook({
        userId: user.id,
      }),
    );
    const { id } = book;
    const response = await request(app).get(`/${id}`).set("Cookie", [token]);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");

    const responseBook = response.body.data;
    assertBook(responseBook);
  });

  it("should add a book", async () => {
    const newBook = createTestBook({
      userId: user.id,
    });
    const response = await request(app).post("/").send(newBook).set("Cookie", [token]);

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("success");

    const responseBook = response.body.data;
    assertBook(responseBook);
  });

  it("should update a book", async () => {
    const book = await BookModel.create(
      createTestBook({
        userId: user.id,
      }),
    );
    const { id } = book;
    const body = { name: "Updated Book" };
    const response = await request(app).patch(`/${id}`).send(body).set("Cookie", [token]);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");

    const responseBook = response.body.data;
    assertBook(responseBook);
    expect(responseBook.name).toBe(body.name);
  });
});
