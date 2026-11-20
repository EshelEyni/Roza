import { Request, Response } from "express";
import { BookModel } from "../../models/books/bookModel";
import { getLoggedInUserIdFromReq } from "../../services/ALSService";
import { AppError, asyncErrorCatcher } from "../../services/error/errorService";
import { parseAudiobookNarrator } from "../../services/reader/audiobookNarrator";

function ownedManuscript(id: string) {
  const userId = getLoggedInUserIdFromReq();
  if (!userId) throw new AppError("User not logged in", 401);
  return { _id: id, userId, isArchived: false };
}

export const loadStudioNarrator = asyncErrorCatcher(async (req: Request, res: Response) => {
  const book = await BookModel.findOne(ownedManuscript(req.params.id))
    .select("audiobookNarrator").lean();
  if (!book) throw new AppError("Book not found", 404);
  res.setHeader("Cache-Control", "no-store");
  res.json({ status: "success", data: book.audiobookNarrator ?? null });
});

export const saveStudioNarrator = asyncErrorCatcher(async (req: Request, res: Response) => {
  const filter = ownedManuscript(req.params.id);
  const narrator = parseAudiobookNarrator(req.body);
  // Narration preferences are independent of the manuscript's autosave version.
  const result = await BookModel.updateOne(filter, { $set: { audiobookNarrator: narrator } }, {
    runValidators: true,
    timestamps: false,
  });
  if (!result.matchedCount) throw new AppError("Book not found", 404);
  res.setHeader("Cache-Control", "no-store");
  res.json({ status: "success", data: narrator });
});
