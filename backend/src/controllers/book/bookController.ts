import { validatePlanning } from "./planningValidation";
import { Types } from "mongoose";
import { BookModel } from "../../models/books/bookModel";
import { AppError, asyncErrorCatcher } from "../../services/error/errorService";
import { NextFunction, Request, Response } from "express";
import { getLoggedInUserIdFromReq } from "../../services/ALSService";
import { Book } from "../../../../shared/types/books";

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
  try { validatePlanning(req.body, String(req.body.id || req.body._id || "")); }
  catch (error) { throw new AppError((error as Error).message, 400); }
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
  ];
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
  try { validatePlanning({ ...current, ...changes }, id); }
  catch (error) { throw new AppError((error as Error).message, 400); }
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

  res.json({ status: "success", data: book });
});

export { getBooks, getBookById, addBook, updateBook };
