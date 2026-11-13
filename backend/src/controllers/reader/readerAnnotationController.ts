import { Request, Response } from "express";
import mongoose from "mongoose";
import { ReaderBookModel } from "../../models/reader/readerBookModel";
import { ReaderAnnotationModel } from "../../models/reader/readerAnnotationModel";
import { getLoggedInUserIdFromReq } from "../../services/ALSService";
import { AppError, asyncErrorCatcher } from "../../services/error/errorService";
import type { AnnotationColor } from "../../../../shared/types/readerAnnotations";

// Shared types are ESM; keep runtime validation local to the CommonJS backend.
const annotationColors: readonly AnnotationColor[] = ["none", "yellow", "green", "blue", "pink"];

async function scope(req: Request) {
  const userId = getLoggedInUserIdFromReq();
  if (
    !mongoose.isValidObjectId(req.params.id) ||
    !(await ReaderBookModel.exists({ _id: req.params.id, userId }))
  )
    throw new AppError("Book not found.", 404);
  return { userId, bookId: req.params.id };
}
const validCfi = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length <= 4096 &&
  /^epubcfi\(\/6\/\d+(?:\[[^<>]*?\])?!\/[^<>]+\)$/.test(value);
export const listAnnotations = asyncErrorCatcher(async (req: Request, res: Response) => {
  const filter = await scope(req);
  res.setHeader("Cache-Control", "no-store");
  res.json({ status: "success", data: await ReaderAnnotationModel.find(filter) });
});
export const saveAnnotation = asyncErrorCatcher(async (req: Request, res: Response) => {
  const filter = await scope(req);
  const { cfi, endCfi = "", text, chapter, color, note } = req.body;
  if (
    !validCfi(cfi) ||
    (endCfi !== "" && !validCfi(endCfi)) ||
    typeof text !== "string" ||
    !text.trim() ||
    text.length > 100000 ||
    typeof chapter !== "string" ||
    chapter.length > 1000 ||
    !annotationColors.includes(color) ||
    typeof note !== "string" ||
    note.length > 10000
  )
    throw new AppError("Invalid annotation.", 400);
  const data = { cfi, endCfi, text, chapter, color, note };
  const annotation = await ReaderAnnotationModel.findOneAndUpdate(
    { ...filter, cfi, endCfi },
    { $set: data },
    { new: true, upsert: true, runValidators: true },
  );
  res.json({ status: "success", data: annotation });
});
export const deleteAnnotation = asyncErrorCatcher(async (req: Request, res: Response) => {
  const filter = await scope(req);
  if (!mongoose.isValidObjectId(req.params.annotationId))
    throw new AppError("Annotation not found.", 404);
  const deleted = await ReaderAnnotationModel.findOneAndDelete({
    ...filter,
    _id: req.params.annotationId,
  });
  if (!deleted) throw new AppError("Annotation not found.", 404);
  res.json({ status: "success", data: null });
});
