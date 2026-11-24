import mongoose, { Types } from "mongoose";
import { NextFunction, Request, Response } from "express";
import type { BookChange, BookCollection } from "../../../../shared/types/books";
import { BookModel } from "../../models/books/bookModel";
import { AppError, asyncErrorCatcher } from "../../services/error/errorService";
import { getLoggedInUserIdFromReq } from "../../services/ALSService";
import { refreshLiveCopies } from "../../services/stagingRoom/changes";
import { logger } from "../../services/logger/loggerService";
import { markTiming, sendTimedJson } from "../../services/serverTiming";
import { validatePlanning } from "./planningValidation";

// Writing Studio saves send only what changed since the last confirmed
// version. The server reads a small index of the book (ids, names, planning
// links, task boards, draft names), checks the changes against it, and writes
// them in one atomic pipeline update. Chapter text and drafts are never read
// or re-validated unless they changed, so a save costs the same at any book size.

type Doc = Record<string, unknown>;
type Item = Doc & { _id: Types.ObjectId };

const collections: BookCollection[] = ["chapters", "characters", "themes", "plotlines", "notes"];
const bookFields = ["name", "filterBy", "isReadMode", "wordGoal", "taskBoard"] as const;
const maxChanges = 1000;
const fieldName = /^[A-Za-z][A-Za-z0-9]{0,63}$/;
const objectIdPattern = /^[a-f0-9]{24}$/i;
// Identity fields are fixed by the server. Drafts change through draft changes.
const lockedItemFields = new Set(["_id", "id", "bookId", "type"]);
const lockedDraftFields = new Set(["id", "chapterId"]);

const indexProjection = {
  userId: 1,
  name: 1,
  updatedAt: 1,
  wordGoal: 1,
  taskBoard: 1,
  ...Object.fromEntries(
    collections.flatMap(c => ["_id", "bookId", "isArchived", "name"].map(f => [`${c}.${f}`, 1])),
  ),
  "chapters.planning": 1,
  "chapters.taskBoard": 1,
  "chapters.drafts.id": 1,
  "chapters.drafts.chapterId": 1,
  "chapters.drafts.name": 1,
  "chapters.drafts.createdAt": 1,
  "chapters.drafts.updatedAt": 1,
};

const lit = (value: unknown) => ({ $literal: value });
const isPlainObject = (value: unknown): value is Doc =>
  !!value && typeof value === "object" && !Array.isArray(value);
const fail = (message: string): never => {
  throw new AppError(message, 400);
};

function checkFields(set: unknown, unset: unknown, locked: Set<string>) {
  if (!isPlainObject(set)) fail("Invalid change.");
  if (unset !== undefined && (!Array.isArray(unset) || unset.length > 64)) fail("Invalid change.");
  for (const key of [...Object.keys(set as Doc), ...((unset as string[]) || [])])
    if (typeof key !== "string" || !fieldName.test(key) || locked.has(key)) fail("Invalid change.");
  return { set: set as Doc, unset: (unset as string[] | undefined) || [] };
}

function validationMessage(error: mongoose.Error.ValidationError) {
  return Object.values(error.errors)[0]?.message || "Invalid manuscript change.";
}

/** Casts and validates values with the book schema, then keeps only the given keys. */
function castFields(source: mongoose.Document, keys: string[]) {
  const plain = source.toObject({ transform: false, virtuals: false, versionKey: false }) as Doc;
  return Object.fromEntries(keys.filter(key => plain[key] !== undefined).map(key => [key, plain[key]]));
}

function validate(doc: mongoose.Document) {
  const error = doc.validateSync();
  if (error) fail(validationMessage(error));
}

/** `{ ...base, ...set }` minus `unset`, as a pipeline expression. */
function mergeExpression(base: string, set: Doc, unset: string[]) {
  let expression: unknown = { $mergeObjects: [base, lit(set)] };
  for (const field of unset)
    expression = { $setField: { field, input: expression, value: "$$REMOVE" } };
  return expression;
}

/** Replaces the matching array element with `replace(element)`. */
function mapMatching(input: unknown, as: string, key: string, match: unknown, replace: unknown) {
  return {
    $map: {
      input,
      as,
      in: { $cond: [{ $eq: [`$$${as}.${key}`, match] }, replace, `$$${as}`] },
    },
  };
}

function pickByIds(input: unknown, as: string, key: string, ids: unknown[]) {
  return {
    $map: {
      input: lit(ids),
      as: "wanted",
      in: { $first: { $filter: { input, as, cond: { $eq: [`$$${as}.${key}`, "$$wanted"] } } } },
    },
  };
}

const saveBookChanges = asyncErrorCatcher(async (req: Request, res: Response, _next: NextFunction) => {
  markTiming(res, "pre");
  const { id } = req.params;
  const userId = getLoggedInUserIdFromReq();
  if (!userId) throw new AppError("User not logged in", 401);
  const { updatedAt, changes } = req.body ?? {};
  if (typeof updatedAt !== "string" || !Number.isFinite(Date.parse(updatedAt)))
    throw new AppError("Reload the manuscript before saving its contents.", 409);
  if (!Array.isArray(changes) || !changes.length || changes.length > maxChanges)
    fail("Invalid manuscript changes.");

  const bookId = new Types.ObjectId(id);
  // Read raw storage: find middleware would hide archived children.
  const book = (await BookModel.collection.findOne(
    { _id: bookId, userId: new Types.ObjectId(userId), isArchived: { $ne: true } },
    { projection: indexProjection },
  )) as Doc | null;
  markTiming(res, "read");
  if (!book) throw new AppError("Book not found", 404);
  if (new Date(updatedAt).getTime() !== new Date(book.updatedAt as Date).getTime())
    throw new AppError(
      "This manuscript changed in another session. Export your draft, then reload to review the latest version.",
      409,
    );

  const userObjectId = book.userId as Types.ObjectId;
  const now = new Date();
  const stages: Doc[] = [];
  const list = (collection: BookCollection) => {
    if (!Array.isArray(book[collection])) book[collection] = [];
    return book[collection] as Item[];
  };

  for (const change of changes as BookChange[]) {
    if (!isPlainObject(change)) fail("Invalid manuscript change.");
    if (change.type === "book") {
      const { set } = checkFields(change.set, undefined, new Set());
      const keys = Object.keys(set);
      if (!keys.length || keys.some(key => !(bookFields as readonly string[]).includes(key)))
        fail("Invalid book change.");
      const doc = new BookModel({ userId: userObjectId, name: book.name, ...set });
      validate(doc);
      const values = castFields(doc, keys);
      Object.assign(book, values);
      stages.push({ $set: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, lit(v)])) });
    } else if (change.type === "item") {
      if (!collections.includes(change.collection) || typeof change.id !== "string" || !objectIdPattern.test(change.id))
        fail("Invalid manuscript item.");
      const { set, unset } = checkFields(change.set, change.unset, lockedItemFields);
      const items = list(change.collection);
      const itemId = new Types.ObjectId(change.id);
      const stored = items.find(item => itemId.equals(item._id));
      if (stored && ("drafts" in set || unset.includes("drafts"))) fail("Change drafts one at a time.");
      const merged: Doc = { ...stored, ...set, _id: itemId, bookId };
      for (const field of unset) delete merged[field];
      if (!stored && Array.isArray(set.drafts))
        try {
          // A new chapter may arrive with drafts; check them like the full save does.
          validatePlanning({ chapters: [{ _id: itemId, drafts: set.drafts }] }, id);
        } catch (error) {
          fail((error as Error).message);
        }
      const doc = new BookModel({ userId: userObjectId, name: "-", [change.collection]: [merged] });
      validate(doc);
      const subdoc = (doc.get(change.collection) as mongoose.Document[])[0];
      if (stored) {
        const values = { ...castFields(subdoc, Object.keys(set)), updatedAt: now };
        Object.assign(stored, values);
        for (const field of unset) delete stored[field];
        stages.push({
          $set: {
            [change.collection]: mapMatching(
              `$${change.collection}`, "item", "_id", itemId,
              mergeExpression("$$item", values, unset),
            ),
          },
        });
      } else {
        const created = {
          ...subdoc.toObject({ transform: false, virtuals: false, versionKey: false }),
          createdAt: now,
          updatedAt: now,
        } as Item;
        items.push(created);
        stages.push({
          $set: {
            [change.collection]: {
              $concatArrays: [{ $ifNull: [`$${change.collection}`, []] }, [lit(created)]],
            },
          },
        });
      }
    } else if (change.type === "order") {
      if (!collections.includes(change.collection) || !Array.isArray(change.ids)) fail("Invalid order.");
      const items = list(change.collection);
      const ids = change.ids.map(value =>
        typeof value === "string" && objectIdPattern.test(value) ? new Types.ObjectId(value) : fail("Invalid order."),
      ) as Types.ObjectId[];
      const keys = ids.map(String);
      if (new Set(keys).size !== keys.length) fail("Invalid order.");
      const byId = new Map(items.map(item => [String(item._id), item]));
      if (keys.some(key => !byId.has(key))) fail("An ordered item does not exist.");
      const kept = items.filter(item => item.isArchived && !keys.includes(String(item._id)));
      book[change.collection] = [...keys.map(key => byId.get(key)!), ...kept];
      const all = `$$all`;
      stages.push({
        $set: {
          [change.collection]: {
            $let: {
              vars: { all: { $ifNull: [`$${change.collection}`, []] } },
              in: {
                $concatArrays: [
                  pickByIds(all, "entry", "_id", ids),
                  {
                    $filter: {
                      input: all,
                      as: "entry",
                      cond: {
                        $and: [
                          { $eq: ["$$entry.isArchived", true] },
                          { $not: [{ $in: ["$$entry._id", lit(ids)] }] },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      });
    } else if (change.type === "draft" || change.type === "draftOrder") {
      if (typeof change.chapterId !== "string" || !objectIdPattern.test(change.chapterId))
        fail("Invalid chapter draft.");
      const chapterId = new Types.ObjectId(change.chapterId);
      const chapter = list("chapters").find(item => chapterId.equals(item._id));
      if (!chapter) fail("A draft belongs to another chapter.");
      if (!Array.isArray((chapter as Doc).drafts)) (chapter as Doc).drafts = [];
      const drafts = (chapter as Doc).drafts as Doc[];
      let inner: unknown;
      if (change.type === "draft") {
        if (typeof change.id !== "string" || !change.id || change.id.length > 200) fail("Invalid chapter draft.");
        const { set, unset } = checkFields(change.set, change.unset, lockedDraftFields);
        const stored = drafts.find(draft => draft.id === change.id);
        if (!stored && !Array.isArray(set.text)) fail("Invalid chapter draft.");
        const merged: Doc = { ...stored, ...set, id: change.id, chapterId: String(chapterId) };
        for (const field of unset) delete merged[field];
        // Unchanged text is not read; a placeholder lets the schema check the rest.
        const check = { ...merged, text: set.text ?? [{ type: "paragraph", children: [{ text: "" }] }] };
        try {
          validatePlanning({ chapters: [{ _id: chapterId, drafts: [check] }] }, id);
        } catch (error) {
          fail((error as Error).message);
        }
        const doc = new BookModel({ userId: userObjectId, name: "-", chapters: [{ bookId, drafts: [check] }] });
        validate(doc);
        const draftDoc = ((doc.get("chapters") as mongoose.Document[])[0].get("drafts") as mongoose.Document[])[0];
        if (stored) {
          const values = castFields(draftDoc, Object.keys(set));
          Object.assign(stored, values);
          for (const field of unset) delete stored[field];
          inner = mapMatching("$$chapter.drafts", "draft", "id", lit(change.id), mergeExpression("$$draft", values, unset));
        } else {
          const created = castFields(draftDoc, Object.keys(merged));
          drafts.push(created);
          inner = { $concatArrays: [{ $ifNull: ["$$chapter.drafts", []] }, [lit(created)]] };
        }
      } else {
        if (!Array.isArray(change.ids) || change.ids.some(value => typeof value !== "string"))
          fail("Invalid draft order.");
        const ids = change.ids as string[];
        if (new Set(ids).size !== ids.length || ids.some(draftId => !drafts.some(d => d.id === draftId)))
          fail("An ordered draft does not exist.");
        (chapter as Doc).drafts = ids.map(draftId => drafts.find(d => d.id === draftId));
        inner = pickByIds({ $ifNull: ["$$chapter.drafts", []] }, "draft", "id", ids);
      }
      stages.push({
        $set: {
          chapters: mapMatching("$chapters", "chapter", "_id", chapterId, {
            $mergeObjects: ["$$chapter", { drafts: inner }],
          }),
        },
      });
    } else fail("Invalid manuscript change.");
  }

  // Check links between items against the whole book index. Drafts were
  // checked one by one above, so they are left out here.
  try {
    validatePlanning(
      {
        ...book,
        chapters: list("chapters").map(chapter => ({ ...chapter, drafts: undefined })),
      },
      id,
    );
  } catch (error) {
    fail((error as Error).message);
  }
  markTiming(res, "validate");

  const nextUpdatedAt = new Date(Math.max(now.getTime(), new Date(book.updatedAt as Date).getTime() + 1));
  stages.push({ $set: { updatedAt: nextUpdatedAt } });
  // Atomic compare-and-swap: fails if another save landed after the read.
  const result = await BookModel.collection.updateOne(
    { _id: bookId, userId: userObjectId, updatedAt: book.updatedAt, isArchived: { $ne: true } },
    stages,
  );
  markTiming(res, "write");
  if (!result.matchedCount)
    throw new AppError("This manuscript changed while saving. Export your draft and reload.", 409);

  refreshLiveCopies(mongoose.connection, id).catch(error =>
    logger.error("Staging Room live copy refresh failed:", error as Error),
  );
  sendTimedJson(req, res, {
    status: "success",
    data: { id, updatedAt: nextUpdatedAt.toISOString(), wordGoal: book.wordGoal },
  });
});

export { saveBookChanges };
