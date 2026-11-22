/**
 * Staging Room checks and writes books with the Writing Studio's own Mongoose
 * schemas, so staged books accept exactly the fields a Writing Studio book has.
 * Earlier this file held a copy of those schemas. The copy fell behind (draft
 * kind and summary, mainSourceDraftId, publishing, audiobookNarrator) and Push
 * dropped the missing fields. Do not copy the schemas here again.
 *
 * The book schema's find hooks are not used: Staging Room reads books through
 * the raw collection. It uses this model only to cast, validate and save.
 */
import { Connection } from "mongoose";
import { bookSchema } from "../../models/books/schemas/bookSchema";

export { bookSchema };

export const STAGING_BOOK_MODEL = "StagingRoomBook";

export const bookModelFor = (conn: Connection) =>
  conn.models[STAGING_BOOK_MODEL] || conn.model(STAGING_BOOK_MODEL, bookSchema, "books");
