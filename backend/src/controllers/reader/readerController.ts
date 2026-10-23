import { Request, Response } from "express";
import mongoose from "mongoose";
import { ReaderBookModel } from "../../models/reader/readerBookModel";
import { getLoggedInUserIdFromReq } from "../../services/ALSService";
import { AppError, asyncErrorCatcher } from "../../services/error/errorService";
import { isReaderEnabled } from "../../services/reader/readerAccessService";
import { parseEpub } from "../../services/reader/epubService";
import {
  getReaderBucket,
  saveReaderFile,
  removeReaderFile,
} from "../../services/reader/readerStorageService";
import { defaultReaderPreferences } from "../../services/reader/readerUtilService";

const getReaderAccess = asyncErrorCatcher(async (_req: Request, res: Response) => {
  res.json({ status: "success", data: { enabled: isReaderEnabled(getLoggedInUserIdFromReq()) } });
});

const getReaderBooks = asyncErrorCatcher(async (_req: Request, res: Response) => {
  const books = await ReaderBookModel.find({ userId: getLoggedInUserIdFromReq() }).sort({
    updatedAt: -1,
  });
  res.setHeader("Cache-Control", "no-store");
  res.json({ status: "success", data: books });
});

const addReaderBook = asyncErrorCatcher(async (req: Request, res: Response) => {
  if (!Buffer.isBuffer(req.body)) throw new AppError("Upload an EPUB file.", 400);
  let filename = "book.epub";
  try {
    filename = decodeURIComponent(String(req.headers["x-filename"] || filename));
  } catch {
    throw new AppError("Invalid filename.", 400);
  }
  filename = filename
    .split(/[/\\]/)
    .pop()!
    .replace(/[\x00-\x1f]/g, "")
    .slice(0, 250);
  if (!/\.epub$/i.test(filename)) throw new AppError("Only EPUB files are supported.", 400);
  const epub = parseEpub(req.body, filename);
  const userId = getLoggedInUserIdFromReq();
  const previous = await ReaderBookModel.findOne({ userId }).sort({ updatedAt: -1 });
  const ids: mongoose.Types.ObjectId[] = [];
  try {
    const originalFileId = await saveReaderFile(req.body, filename, userId);
    ids.push(originalFileId);
    const fileId = await saveReaderFile(epub.buffer, filename, userId);
    ids.push(fileId);
    const book = await ReaderBookModel.create({
      userId,
      title: epub.title,
      author: epub.author,
      cover: epub.cover,
      filename,
      size: req.body.length,
      fileId,
      originalFileId,
      state: {
        location: "",
        progress: 0,
        savedAt: 0,
        preferences: previous?.state?.preferences || defaultReaderPreferences,
      },
    });
    res.status(201).json({ status: "success", data: book });
  } catch (error) {
    await Promise.allSettled(ids.map(removeReaderFile));
    throw error;
  }
});

async function findReaderBook(req: Request) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError("Book not found.", 404);
  const book = await ReaderBookModel.findOne({
    _id: req.params.id,
    userId: getLoggedInUserIdFromReq(),
  }).select("+fileId +originalFileId");
  if (!book) throw new AppError("Book not found.", 404);
  return book;
}

const getReaderBook = asyncErrorCatcher(async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ status: "success", data: await findReaderBook(req) });
});

const getReaderFile = asyncErrorCatcher(async (req: Request, res: Response) => {
  const book = await findReaderBook(req);
  const bucket = getReaderBucket();
  const file = await bucket.find({ _id: book.fileId }).next();
  if (!file) throw new AppError("Book file not found.", 404);
  res.setHeader("Content-Type", "application/epub+zip");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Disposition", "attachment; filename=book.epub");
  const stream = bucket.openDownloadStream(book.fileId);
  stream.on("error", () => res.destroy());
  res.on("close", () => stream.destroy());
  stream.pipe(res);
});

const updateReaderState = asyncErrorCatcher(async (req: Request, res: Response) => {
  const book = await findReaderBook(req);
  const { location, progress, preferences, savedAt } = req.body;
  if (
    typeof location !== "string" ||
    location.length > 4096 ||
    (location !== "" && !/^epubcfi\([^<>]*\)$/.test(location)) ||
    typeof progress !== "number" ||
    !Number.isFinite(progress) ||
    progress < 0 ||
    progress > 1 ||
    !Number.isSafeInteger(savedAt) ||
    savedAt <= 0
  )
    throw new AppError("Invalid reading position.", 400);
  if (
    !preferences ||
    typeof preferences !== "object" ||
    !Number.isFinite(preferences.fontSize) ||
    preferences.fontSize < 14 ||
    preferences.fontSize > 36 ||
    !Number.isFinite(preferences.lineHeight) ||
    preferences.lineHeight < 1.2 ||
    preferences.lineHeight > 2.4 ||
    !["serif", "sans-serif"].includes(preferences.fontFamily) ||
    !["comfortable", "wide"].includes(preferences.width) ||
    !["light", "sepia", "dark"].includes(preferences.theme) ||
    !["paginated", "scrolled"].includes(preferences.flow) ||
    (preferences.pageNumbering !== undefined && !["screen", "publisher"].includes(preferences.pageNumbering))
  )
    throw new AppError("Invalid reader preferences.", 400);
  const safePreferences = {
    fontSize: preferences.fontSize,
    lineHeight: preferences.lineHeight,
    fontFamily: preferences.fontFamily,
    width: preferences.width,
    theme: preferences.theme,
    flow: preferences.flow,
    pageNumbering: preferences.pageNumbering ?? "screen",
  };
  // A delayed page-leave request must not overwrite a more recent position.
  const updated = await ReaderBookModel.findOneAndUpdate(
    {
      _id: book._id,
      userId: getLoggedInUserIdFromReq(),
      $or: [{ "state.savedAt": { $lte: savedAt } }, { "state.savedAt": { $exists: false } }],
    },
    { $set: { state: { location, progress, savedAt, preferences: safePreferences } } },
    { new: true, runValidators: true },
  );
  res.json({ status: "success", data: updated?.state || book.state });
});

export {
  getReaderAccess,
  getReaderBooks,
  addReaderBook,
  getReaderBook,
  getReaderFile,
  updateReaderState,
};
