import { createHash } from "node:crypto";
import mongoose from "mongoose";
import type { PipelineStage } from "mongoose";
import type { ReaderLibraryCounts, ReaderLibrarySort } from "../../../../shared/types/reader";
import { ReaderBookModel } from "../../models/reader/readerBookModel";
import { AppError } from "../error/errorService";

const pageSize = 8;
const objectId = /^[a-f0-9]{24}$/i;
const customKey = { $ifNull: ["$customRank", { $toLong: "$createdAt" }] };
const sortKeys = {
  recent: { $cond: [{ $gt: ["$state.savedAt", 0] }, "$state.savedAt", { $toLong: "$createdAt" }] },
  title: { $toLower: { $ifNull: ["$title", ""] } },
  author: { $toLower: { $ifNull: ["$author", ""] } },
  added: { $toLong: "$createdAt" },
  custom: customKey,
} satisfies Record<ReaderLibrarySort, object>;

const progress = { $ifNull: ["$state.progress", 0] };
const readingStatus = {
  $switch: {
    branches: [
      { case: { $gte: [progress, 1] }, then: "finished" },
      { case: { $or: [{ $gt: [progress, 0] }, { $ne: [{ $ifNull: ["$state.location", ""] }, ""] }] }, then: "reading" },
    ],
    default: "unread",
  },
};

type Cursor = { pin: number; key: number | string; id: string; scope: string };

function parseCursor(raw: unknown, scope: string, textSort: boolean): Cursor | undefined {
  if (raw === undefined) return;
  try {
    if (typeof raw !== "string") throw new Error();
    const cursor: Cursor = JSON.parse(Buffer.from(raw, "base64url").toString());
    if (cursor.scope !== scope || ![0, 1].includes(cursor.pin) ||
        typeof cursor.id !== "string" || !objectId.test(cursor.id) ||
        (textSort ? typeof cursor.key !== "string" : !Number.isSafeInteger(cursor.key))) {
      throw new Error();
    }
    return cursor;
  } catch {
    throw new AppError("Invalid library cursor.", 400);
  }
}

export async function listReaderBooks(userId: string, query: Record<string, unknown>) {
  const archived = query.archived === "true";
  const status = query.status ?? "all";
  if (status !== "all" && status !== "reading" && status !== "unread" && status !== "finished") {
    throw new AppError("Invalid library reading status.", 400);
  }
  const sort = query.sort ?? "recent";
  if (typeof sort !== "string" || !Object.prototype.hasOwnProperty.call(sortKeys, sort)) {
    throw new AppError("Invalid library sort.", 400);
  }
  const mode = sort as ReaderLibrarySort;
  const search = query.q ?? "";
  if (typeof search !== "string" || search.length > 200) {
    throw new AppError("Invalid library search.", 400);
  }
  const term = search.trim();
  const ignorePins = query.ignorePins === "true";
  const scope = JSON.stringify([userId, archived, mode, term, status, ...(ignorePins ? [true] : [])]);
  const cursor = parseCursor(query.cursor, scope, mode === "title" || mode === "author");
  const literal = term.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&");
  const contains = { $regex: literal, $options: "i" };
  const direction = (mode === "recent" || mode === "added") ? -1 : 1;
  const compare = direction === -1 ? "$lt" : "$gt";
  const owner = new mongoose.Types.ObjectId(userId);
  const pipeline: PipelineStage[] = [
    { $match: {
      userId: owner,
      ...(status !== "all" && { $expr: { $eq: [readingStatus, status] } }),
      archived: archived ? true : { $ne: true },
      ...(term && { $or: [{ title: contains }, { author: contains }] }),
    } },
    { $addFields: { pin: ignorePins ? { $literal: 0 } : { $cond: ["$pinned", 1, 0] }, key: sortKeys[mode] } },
  ];
  if (cursor) {
    pipeline.push({ $match: { $or: [
      { pin: { $lt: cursor.pin } },
      { pin: cursor.pin, key: { [compare]: cursor.key } },
      { pin: cursor.pin, key: cursor.key, _id: { [compare]: new mongoose.Types.ObjectId(cursor.id) } },
    ] } });
  }
  pipeline.push(
    { $sort: { pin: -1, key: direction, _id: direction } },
    { $limit: pageSize + 1 },
    { $project: { ...(!ignorePins && { fileId: 0 }), originalFileId: 0, userId: 0 } },
  );
  const [books, totals, resumable] = await Promise.all([
    ReaderBookModel.aggregate(pipeline),
    query.counts === "true" && !cursor
      ? ReaderBookModel.aggregate<{ _id: Exclude<keyof ReaderLibraryCounts, "all">; count: number }>([
          { $match: { userId: owner, archived: { $ne: true } } },
          { $group: { _id: readingStatus, count: { $sum: 1 } } },
        ])
      : undefined,
    query.resume === "true" && !archived && !term && status === "all" && !cursor
      ? ReaderBookModel.aggregate([
          { $match: { userId: owner, archived: { $ne: true }, $expr: { $eq: [readingStatus, "reading"] } } },
          { $sort: { "state.savedAt": -1, _id: -1 } },
          { $limit: 1 },
          { $project: { fileId: 0, originalFileId: 0, userId: 0 } },
        ])
      : undefined,
  ]);
  let counts: ReaderLibraryCounts | undefined;
  if (totals) {
    counts = { all: 0, reading: 0, unread: 0, finished: 0 };
    for (const { _id, count } of totals) {
      counts[_id] = count;
      counts.all += count;
    }
  }
  const page = books.slice(0, pageSize);
  const last = page.at(-1);
  const nextCursor = books.length > pageSize ? Buffer.from(JSON.stringify({
    pin: last.pin, key: typeof last.key === "string" ? last.key : Number(last.key),
    id: String(last._id), scope,
  })).toString("base64url") : null;
  return {
    books: page.map(({ pin, key, fileId, ...book }) => ({
      ...ReaderBookModel.hydrate(book).toJSON(),
      ...(ignorePins && fileId && { fileRevision: createHash("sha256").update(String(fileId)).digest("hex") }),
    })),
    nextCursor,
    ...(counts && { counts }),
    ...(resumable?.[0] && { resume: ReaderBookModel.hydrate(resumable[0]).toJSON() }),
  };
}

export async function moveReaderBook(
  userId: string,
  id: string,
  { anchorId, placement, archived }: { anchorId?: unknown; placement?: unknown; archived?: unknown },
) {
  if (!objectId.test(id) || typeof anchorId !== "string" || !objectId.test(anchorId) ||
      id === anchorId || typeof archived !== "boolean" || (placement !== "before" && placement !== "after")) {
    throw new AppError("Invalid library move.", 400);
  }

  await mongoose.connection.transaction(async session => {
    // A single order spans both views and pin groups. Changing either flag
    // leaves the book's position in that order intact.
    const owner = new mongoose.Types.ObjectId(userId);
    const books = await ReaderBookModel.aggregate<{
      _id: mongoose.Types.ObjectId; customRank?: number; archived?: boolean; pinned?: boolean;
    }>([
      { $match: { userId: owner } },
      { $project: { customRank: 1, archived: 1, pinned: 1, key: customKey } },
      { $sort: { key: 1, _id: 1 } },
    ]).session(session);
    const source = books.findIndex(book => book._id.equals(id));
    const target = books.findIndex(book => book._id.equals(anchorId));
    if (source === -1 || target === -1) throw new AppError("Book not found.", 404);
    const book = books[source];
    const anchor = books[target];
    if (Boolean(book.archived) !== archived || Boolean(anchor.archived) !== archived ||
        Boolean(book.pinned) !== Boolean(anchor.pinned)) {
      throw new AppError("Books must be in the same library group.", 409);
    }

    books.splice(source, 1);
    books.splice(books.indexOf(anchor) + Number(placement === "after"), 0, book);
    const writes = books.flatMap((item, customRank) => item.customRank === customRank ? [] : [{
      updateOne: {
        filter: { _id: item._id, userId: owner },
        update: { $set: { customRank } },
        timestamps: false,
      },
    }]);
    if (writes.length) await ReaderBookModel.bulkWrite(writes, { session });
  });
}
