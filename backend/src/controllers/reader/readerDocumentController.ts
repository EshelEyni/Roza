import { Request, Response } from "express";
import mongoose from "mongoose";
import { ReaderBookModel } from "../../models/reader/readerBookModel";
import { ReaderDocumentModel } from "../../models/reader/readerDocumentModel";
import { getLoggedInUserIdFromReq } from "../../services/ALSService";
import { AppError, asyncErrorCatcher } from "../../services/error/errorService";
import {
  MAX_DOCUMENTS_PER_BOOK,
  documentPreview,
  emptyDocumentContent,
  normalizeDocumentContent,
  normalizeDocumentTitle,
} from "../../services/reader/readerDocumentContent";

async function scope(req: Request) {
  const userId = getLoggedInUserIdFromReq();
  if (
    !mongoose.isValidObjectId(req.params.id) ||
    !(await ReaderBookModel.exists({ _id: req.params.id, userId }))
  )
    throw new AppError("Book not found.", 404);
  return { userId, bookId: req.params.id };
}

function documentId(req: Request) {
  if (!mongoose.isValidObjectId(req.params.documentId))
    throw new AppError("Document not found.", 404);
  return req.params.documentId;
}

export const listDocuments = asyncErrorCatcher(async (req: Request, res: Response) => {
  const filter = await scope(req);
  res.setHeader("Cache-Control", "no-store");
  const documents = await ReaderDocumentModel.find(filter)
    .select("-content")
    .sort({ updatedAt: -1 });
  res.json({ status: "success", data: documents });
});

export const getDocument = asyncErrorCatcher(async (req: Request, res: Response) => {
  const filter = await scope(req);
  const document = await ReaderDocumentModel.findOne({ ...filter, _id: documentId(req) });
  if (!document) throw new AppError("Document not found.", 404);
  res.setHeader("Cache-Control", "no-store");
  res.json({ status: "success", data: document });
});

export const createDocument = asyncErrorCatcher(async (req: Request, res: Response) => {
  const filter = await scope(req);
  const title = normalizeDocumentTitle(req.body?.title);
  const content =
    req.body?.content === undefined ? emptyDocumentContent() : normalizeDocumentContent(req.body.content);
  if (!title || !content) throw new AppError("Invalid document.", 400);
  if ((await ReaderDocumentModel.countDocuments(filter)) >= MAX_DOCUMENTS_PER_BOOK)
    throw new AppError(`A book can have up to ${MAX_DOCUMENTS_PER_BOOK} documents.`, 400);
  const document = await ReaderDocumentModel.create({
    ...filter,
    title,
    content,
    preview: documentPreview(content),
  });
  res.status(201).json({ status: "success", data: document });
});

export const updateDocument = asyncErrorCatcher(async (req: Request, res: Response) => {
  const filter = await scope(req);
  const id = documentId(req);
  const update: Record<string, unknown> = {};
  if (req.body?.title !== undefined) {
    const title = normalizeDocumentTitle(req.body.title);
    if (!title) throw new AppError("Invalid document title.", 400);
    update.title = title;
  }
  if (req.body?.content !== undefined) {
    const content = normalizeDocumentContent(req.body.content);
    if (!content) throw new AppError("Invalid document content.", 400);
    update.content = content;
    update.preview = documentPreview(content);
  }
  if (!Object.keys(update).length) throw new AppError("Nothing to update.", 400);
  const document = await ReaderDocumentModel.findOneAndUpdate(
    { ...filter, _id: id },
    { $set: update },
    { new: true, runValidators: true },
  ).select("-content");
  if (!document) throw new AppError("Document not found.", 404);
  res.json({ status: "success", data: document });
});

export const deleteDocument = asyncErrorCatcher(async (req: Request, res: Response) => {
  const filter = await scope(req);
  const deleted = await ReaderDocumentModel.findOneAndDelete({ ...filter, _id: documentId(req) });
  if (!deleted) throw new AppError("Document not found.", 404);
  res.json({ status: "success", data: null });
});
