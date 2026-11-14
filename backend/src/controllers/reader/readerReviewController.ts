import { lookupReaderWordWithTranslation } from "../../services/reader/readerDictionaryService";
import { Request, Response } from "express";
import mongoose from "mongoose";
import { ReaderFlagModel } from "../../models/reader/readerFlagModel";
import { ReaderBookModel } from "../../models/reader/readerBookModel";
import {
  ReaderVocabularyModel,
  ReaderLookupModel,
} from "../../models/reader/readerVocabularyModel";
import { getLoggedInUserIdFromReq } from "../../services/ALSService";
import { AppError, asyncErrorCatcher } from "../../services/error/errorService";
const validCfi = (v: unknown): v is string =>
  typeof v === "string" &&
  v.length <= 4096 &&
  /^epubcfi\(\/6\/\d+(?:\[[^<>]*?\])?!\/[^<>]+\)$/.test(v);
async function scope(req: Request) {
  const userId = getLoggedInUserIdFromReq();
  if (
    !mongoose.isValidObjectId(req.params.id) ||
    !(await ReaderBookModel.exists({ _id: req.params.id, userId }))
  )
    throw new AppError("Book not found.", 404);
  return { userId, bookId: req.params.id };
}
export const listFlags = asyncErrorCatcher(
  async (req: Request, res: Response) => {
    const filter = await scope(req);
    res.setHeader("Cache-Control", "no-store");
    res.json({
      status: "success",
      data: await ReaderFlagModel.find(filter).sort({ createdAt: -1 }),
    });
  },
);
export const saveFlag = asyncErrorCatcher(
  async (req: Request, res: Response) => {
    const filter = await scope(req);
    const { cfi, endCfi = "", text, chapter = "", context = "" } = req.body;
    if (
      !validCfi(cfi) ||
      (endCfi !== "" && !validCfi(endCfi)) ||
      typeof text !== "string" ||
      !text.trim() ||
      text.length > 100000 ||
      typeof chapter !== "string" ||
      chapter.length > 1000 ||
      typeof context !== "string" ||
      context.length > 100000
    )
      throw new AppError("Invalid flag.", 400);
    const identity = { ...filter, cfi, endCfi };
    let flag;
    try {
      flag = await ReaderFlagModel.findOneAndUpdate(
        identity,
        { $setOnInsert: { ...identity, text, chapter, context } },
        { new: true, upsert: true, runValidators: true },
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
      flag = await ReaderFlagModel.findOne(identity);
    }
    res.json({ status: "success", data: flag });
  },
);
export const updateFlag = asyncErrorCatcher(
  async (req: Request, res: Response) => {
    const filter = await scope(req);
    if (!mongoose.isValidObjectId(req.params.flagId))
      throw new AppError("Flag not found.", 404);
    const identity = { ...filter, _id: req.params.flagId };
    const flag =
      req.method === "DELETE"
        ? await ReaderFlagModel.findOneAndDelete(identity)
        : typeof req.body.reviewed === "boolean"
          ? await ReaderFlagModel.findOneAndUpdate(
              identity,
              { $set: { reviewed: req.body.reviewed } },
              { new: true },
            )
          : null;
    if (!flag) throw new AppError("Flag not found or invalid update.", 404);
    res.json({ status: "success", data: flag });
  },
);
export const getReview = asyncErrorCatcher(
  async (_req: Request, res: Response) => {
    const userId = getLoggedInUserIdFromReq();
    const books = await ReaderBookModel.find({ userId }).select("title").lean();
    const bookIds = books.map((book) => book._id);
    const [flags, vocabulary, lookups] = await Promise.all([
      ReaderFlagModel.find({ userId, bookId: { $in: bookIds } }).sort({
        createdAt: -1,
      }),
      ReaderVocabularyModel.find({ userId, reviewHidden: { $ne: true } })
        .sort({ lastLookedUpAt: -1 })
        .lean(),
      ReaderLookupModel.find({ userId, bookId: { $in: bookIds } })
        .sort({ createdAt: -1 })
        .lean(),
    ]);
    res.setHeader("Cache-Control", "no-store");
    res.json({
      status: "success",
      data: {
        flags,
        books: books.map((b) => ({ id: String(b._id), title: b.title })),
        vocabulary: vocabulary.map((v) => ({
          id: String(v._id),
          reviewed: v.reviewed,
          headword: v.headword,
          entry: v.entry,
          books: books
            .filter((b) => v.bookIds.some((id) => String(id) === String(b._id)))
            .map((b) => ({
              bookId: String(b._id),
              title: b.title,
              location:
                lookups.find(
                  (l) =>
                    l.headword === v.headword &&
                    String(l.bookId) === String(b._id),
                )?.location || "",
            })),
        })),
      },
    });
  },
);

// Explicit review translation never records a lookup event or changes vocabulary statistics.
export const translateFlag = asyncErrorCatcher(
  async (req: Request, res: Response) => {
    const filter = await scope(req);
    if (!mongoose.isValidObjectId(req.params.flagId))
      throw new AppError("Flag not found.", 404);
    const flag = await ReaderFlagModel.findOne({
      ...filter,
      _id: req.params.flagId,
    });
    const word =
      typeof flag?.text === "string"
        ? flag.text.replace(/^[“"‘(]+|[”"’.,;:!?)]+$/g, "")
        : undefined;
    if (
      !word ||
      !/^[a-zA-Z]+(?:['’-][a-zA-Z]+)*$/.test(word) ||
      word.length > 80
    )
      throw new AppError("Select a single English word.", 400);
    const normalized = word
      .normalize("NFKC")
      .replace(/[’‘]/g, "'")
      .toLowerCase();
    const saved = await ReaderVocabularyModel.findOne({
      userId: filter.userId,
      $or: [{ headword: normalized }, { observedForms: normalized }],
    });
    const entry =
      saved?.entry || (await lookupReaderWordWithTranslation(word, "auto"));
    res.json({ status: "success", data: entry });
  },
);

export const updateVocabularyReview = asyncErrorCatcher(
  async (req: Request, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.vocabularyId))
      throw new AppError("Vocabulary not found.", 404);
    const update =
      req.method === "DELETE"
        ? { reviewHidden: true }
        : typeof req.body.reviewed === "boolean"
          ? { reviewed: req.body.reviewed }
          : null;
    if (!update) throw new AppError("Invalid review status.", 400);
    const item = await ReaderVocabularyModel.findOneAndUpdate(
      { _id: req.params.vocabularyId, userId: getLoggedInUserIdFromReq() },
      { $set: update },
      { new: true },
    );
    if (!item) throw new AppError("Vocabulary not found.", 404);
    res.json({ status: "success", data: null });
  },
);
