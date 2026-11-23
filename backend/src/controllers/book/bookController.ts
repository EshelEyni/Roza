import { validatePlanning } from "./planningValidation";
import mongoose, { Types } from "mongoose";
import { refreshLiveCopies } from "../../services/stagingRoom/changes";
import { logger } from "../../services/logger/loggerService";
import { BookModel } from "../../models/books/bookModel";
import { isWordGoal } from "../../models/books/schemas/bookSchema";
import { AppError, asyncErrorCatcher } from "../../services/error/errorService";
import { NextFunction, Request, Response } from "express";
import { getLoggedInUserIdFromReq } from "../../services/ALSService";
import type { Book, ManuscriptPage, ManuscriptSummary } from "../../../../shared/types/books";
import { countWords } from "../../services/stagingRoom/slate";

const getBooks = asyncErrorCatcher(async (req: Request, res: Response, next: NextFunction) => {
  const loggedInUserId = getLoggedInUserIdFromReq();
  if (!loggedInUserId) return next(new AppError("User not logged in", 401));
  const { limit, sort, searchTerm } = req.query;

  const query = BookModel.find({ userId: loggedInUserId, isArchived: false })
    .limit(limit ? parseInt(limit.toString()) : 10)
    .sort(sort ? sort.toString() : "sortOrder");

  if (searchTerm) {
    query.find({ $text: { $search: searchTerm.toString() } }, { score: { $meta: "textScore" } });
    query.sort({ score: { $meta: "textScore" } });
  }

  const books = (await query.exec()) as unknown as Book[];
  res.json({
    status: "success",
    requestedAt: new Date().toISOString(),
    results: books.length,
    data: books,
  });
});

const manuscriptPageSize = 6;

const getManuscripts = asyncErrorCatcher(async (req: Request, res: Response) => {
  const userId = getLoggedInUserIdFromReq();
  if (!userId) throw new AppError("User not logged in", 401);

  const { q = "", sort = "recent", offset: rawOffset = "0" } = req.query;
  if (typeof q !== "string" || q.length > 200 ||
      (sort !== "recent" && sort !== "title" && sort !== "words") ||
      typeof rawOffset !== "string" || !/^\d+$/.test(rawOffset)) {
    throw new AppError("Invalid manuscript query", 400);
  }
  const offset = Number(rawOffset);
  if (!Number.isSafeInteger(offset + manuscriptPageSize)) {
    throw new AppError("Invalid manuscript offset", 400);
  }

  const term = q.trim();
  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const filter = {
    userId,
    isArchived: { $ne: true },
    ...(term && { name: { $regex: escapedTerm, $options: "i" } }),
  };
  const query = BookModel.find(filter)
    .select("name updatedAt chapters.text chapters.isArchived publishing.cover publishing.readerBookId")
    .lean();
  if (sort === "title") {
    query.collation({ locale: "en", strength: 2 }).sort({ name: 1, _id: 1 });
  } else {
    query.sort({ updatedAt: -1, _id: 1 });
  }
  if (sort !== "words") query.skip(offset).limit(manuscriptPageSize + 1);

  const [books, total] = await Promise.all([
    query.exec(),
    BookModel.countDocuments(filter).exec(),
  ]);
  const summaries: ManuscriptSummary[] = books.map(book => {
    const chapters = (book.chapters ?? []).filter(chapter => !chapter.isArchived);
    return {
      id: String(book._id),
      name: book.name,
      updatedAt: book.updatedAt,
      chapterCount: chapters.length,
      wordCount: chapters.reduce((total, chapter) => total + countWords(chapter.text), 0),
      cover: book.publishing?.cover,
      readerBookId: book.publishing?.readerBookId?.toString(),
    };
  });
  const page = sort === "words"
    ? summaries.sort((a, b) => b.wordCount - a.wordCount).slice(offset, offset + manuscriptPageSize + 1)
    : summaries;
  const data: ManuscriptPage = {
    manuscripts: page.slice(0, manuscriptPageSize),
    total,
    nextOffset: page.length > manuscriptPageSize ? offset + manuscriptPageSize : null,
  };
  res.set("Cache-Control", "no-store").json({ status: "success", data });
});

const getBookById = asyncErrorCatcher(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const loggedInUserId = getLoggedInUserIdFromReq();
  const book = await BookModel.findOne({ _id: id, userId: loggedInUserId, isArchived: false });
  if (!book) throw new AppError(`No book was found with the id: ${id}`, 404);

  res.json({
    status: "success",
    data: book,
  });
});

const addBook = asyncErrorCatcher(async (req: Request, res: Response, next: NextFunction) => {
  const loggedInUserId = getLoggedInUserIdFromReq();
  validateWordGoal(req.body.wordGoal);
  try {
    validatePlanning(req.body, String(req.body.id || req.body._id || ""));
  } catch (error) {
    throw new AppError((error as Error).message, 400);
  }
  const book = await BookModel.create({ ...req.body, userId: loggedInUserId });

  res.status(201).json({
    status: "success",
    data: book,
  });
});

const updateBook = asyncErrorCatcher(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const loggedInUserId = getLoggedInUserIdFromReq();
  if (!loggedInUserId) throw new AppError("User not logged in", 401);
  // Read raw storage because find middleware hides archived children.
  const current = await BookModel.collection.findOne({
    _id: new Types.ObjectId(id),
    userId: new Types.ObjectId(loggedInUserId),
    isArchived: { $ne: true },
  });
  if (!current) throw new AppError("Book not found", 404);
  const expected = req.body.updatedAt;
  if (expected && new Date(expected).getTime() !== new Date(current.updatedAt).getTime())
    throw new AppError(
      "This manuscript changed in another session. Export your draft, then reload to review the latest version.",
      409,
    );
  if (
    !expected &&
    ["chapters", "characters", "themes", "plotlines", "notes", "taskBoard"].some(field =>
      field === "taskBoard" ? req.body[field] !== undefined : Array.isArray(req.body[field]),
    )
  )
    throw new AppError("Reload the manuscript before saving its contents.", 409);
  const fields = [
    "taskBoard",
    "name",
    "chapters",
    "characters",
    "themes",
    "plotlines",
    "notes",
    "filterBy",
    "isArchived",
    "isReadMode",
    "wordGoal",
  ];
  validateWordGoal(req.body.wordGoal);
  const changes: Record<string, unknown> = {};
  for (const field of fields) {
    if (req.body[field] === undefined) continue;
    if (["chapters", "characters", "themes", "plotlines", "notes"].includes(field)) {
      if (!Array.isArray(req.body[field])) throw new AppError("Invalid manuscript items", 400);
      const incoming = req.body[field].map((item: Record<string, unknown>) => {
        const copy = { ...item };
        if (typeof item.id === "string" && /^[a-f0-9]{24}$/i.test(item.id)) copy._id = item.id;
        delete copy.id;
        return copy;
      });
      const ids = new Set(incoming.map((item: Record<string, unknown>) => String(item._id)));
      const stored =
        (current as unknown as Record<string, { isArchived?: boolean; _id: unknown }[]>)[field] ||
        [];
      changes[field] = [
        ...incoming,
        ...stored.filter(item => item.isArchived && !ids.has(String(item._id))),
      ];
    } else changes[field] = req.body[field];
  }
  try {
    validatePlanning({ ...current, ...changes }, id);
  } catch (error) {
    throw new AppError((error as Error).message, 400);
  }
  // Atomic compare-and-swap protects simultaneous requests too.
  const book = await BookModel.findOneAndUpdate(
    { _id: id, userId: loggedInUserId, updatedAt: current.updatedAt },
    {
      $set: {
        ...changes,
        updatedAt: new Date(Math.max(Date.now(), new Date(current.updatedAt).getTime() + 1)),
      },
    },
    { new: true, runValidators: true, timestamps: false },
  );
  if (!book)
    throw new AppError("This manuscript changed while saving. Export your draft and reload.", 409);

  // Staging Room keeps a copy of the live book for Claude. Keep it current.
  refreshLiveCopies(mongoose.connection, id).catch(error =>
    logger.error("Staging Room live copy refresh failed:", error as Error),
  );
  res.json({ status: "success", data: book });
});

function validateWordGoal(value: unknown) {
  if (value !== undefined && !isWordGoal(value))
    throw new AppError("Manuscript word goal must be a whole number from 1 to 10,000,000.", 400);
}

export { getBooks, getManuscripts, getBookById, addBook, updateBook };
