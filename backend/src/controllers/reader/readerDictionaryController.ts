import { Request, Response } from "express";
import mongoose from "mongoose";
import { ReaderBookModel } from "../../models/reader/readerBookModel";
import {
  ReaderLookupModel,
  ReaderVocabularyModel,
} from "../../models/reader/readerVocabularyModel";
import { getLoggedInUserIdFromReq } from "../../services/ALSService";
import { AppError, asyncErrorCatcher } from "../../services/error/errorService";
import { lookupReaderWordWithTranslation } from "../../services/reader/readerDictionaryService";

export const lookupReaderDictionary = asyncErrorCatcher(async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "private, no-store");
  const { word, requestId, location = "", provider = "auto" } = req.body;
  if (provider !== "auto" && provider !== "google")
    throw new AppError("Invalid dictionary provider.", 400);
  if (
    typeof word !== "string" ||
    word.length > 80 ||
    !/^[a-zA-Z]+(?:['’‘-][a-zA-Z]+)*$/.test(word.trim()) ||
    typeof requestId !== "string" ||
    !/^[a-zA-Z0-9-]{16,80}$/.test(requestId) ||
    typeof location !== "string" ||
    location.length > 4096 ||
    (location && !/^epubcfi\([^<>]*\)$/.test(location))
  ) {
    throw new AppError("Select a single English word.", 400);
  }
  const userId = getLoggedInUserIdFromReq();
  if (
    !mongoose.isValidObjectId(req.params.id) ||
    !(await ReaderBookModel.exists({ _id: req.params.id, userId }))
  ) {
    throw new AppError("Book not found.", 404);
  }
  const entry = await lookupReaderWordWithTranslation(word, provider);
  if (!entry) {
    res.json({ status: "success", data: { entry: null } });
    return;
  }
  const identity = { userId, requestId };
  try {
    await ReaderLookupModel.updateOne(
      identity,
      {
        $setOnInsert: {
          ...identity,
          word: entry.word,
          headword: entry.headword,
          provider,
          bookId: req.params.id,
          location,
        },
      },
      { upsert: true },
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  const event = await ReaderLookupModel.findOne(identity).orFail();
  if (
    event.headword !== entry.headword ||
    event.word !== entry.word ||
    String(event.bookId) !== req.params.id ||
    event.location !== location ||
    (event.provider || "auto") !== provider
  ) {
    throw new AppError("This lookup request belongs to another selection.", 409);
  }
  const filter = { userId, headword: entry.headword };
  const lookupCount = await ReaderLookupModel.countDocuments(filter);
  // Count from durable unique events, so a retry also repairs an interrupted vocabulary write.
  const update = {
    $set: { entry },
    $max: { lookupCount, lastLookedUpAt: event.createdAt },
    $min: { firstLookedUpAt: event.createdAt },
    $addToSet: { observedForms: entry.word, bookIds: event.bookId },
  };
  try {
    await ReaderVocabularyModel.updateOne(filter, update, { upsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
    await ReaderVocabularyModel.updateOne(filter, update);
  }
  const vocabulary = await ReaderVocabularyModel.findOne(filter).orFail();
  res.json({ status: "success", data: { entry, lookupCount: vocabulary.lookupCount } });
});
