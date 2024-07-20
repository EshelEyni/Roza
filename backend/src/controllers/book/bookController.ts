import { BookModel } from "../../models/books/bookModel";
import { AppError, asyncErrorCatcher } from "../../services/error/errorService";
import { NextFunction, Request, Response } from "express";
import { getLoggedInUserIdFromReq } from "../../services/ALSService";
import { Book } from "../../../../shared/types/books";

interface BookWithScore extends Book {
  score: number;
}

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
  let sortedBooks = books;
  if (searchTerm && typeof searchTerm === "string") {
    sortedBooks = (books as BookWithScore[]).sort((a, b) => {
      const aNameMatch = a.name.includes(searchTerm) ? 1 : 0;
      const bNameMatch = b.name.includes(searchTerm) ? 1 : 0;

      // Sort by name match first
      if (aNameMatch !== bNameMatch) return bNameMatch - aNameMatch;

      const aChaptersMatch = a.chapters.some(c => c.text.includes(searchTerm)) ? 1 : 0;
      const bChaptersMatch = b.chapters.some(c => c.text.includes(searchTerm)) ? 1 : 0;

      if (aChaptersMatch !== bChaptersMatch) {
        return bChaptersMatch - aChaptersMatch; // Sort by chapters match next
      }

      const aCharactersMatch = a.characters.some(c => c.description.includes(searchTerm)) ? 1 : 0;
      const bCharactersMatch = b.characters.some(c => c.description.includes(searchTerm)) ? 1 : 0;

      if (aCharactersMatch !== bCharactersMatch) {
        return bCharactersMatch - aCharactersMatch; // Sort by characters match next
      }

      const aThemesMatch = a.themes.some(t => t.description.includes(searchTerm)) ? 1 : 0;
      const bThemesMatch = b.themes.some(t => t.description.includes(searchTerm)) ? 1 : 0;

      // Sort by themes match next
      if (aThemesMatch !== bThemesMatch) return bThemesMatch - aThemesMatch;

      const aPlotlinesMatch = a.plotlines.some(p => p.description.includes(searchTerm)) ? 1 : 0;
      const bPlotlinesMatch = b.plotlines.some(p => p.description.includes(searchTerm)) ? 1 : 0;

      // Sort by plotlines match next
      if (aPlotlinesMatch !== bPlotlinesMatch) return bPlotlinesMatch - aPlotlinesMatch;

      const aNotesMatch = a.notes.some(n => n.text.includes(searchTerm)) ? 1 : 0;
      const bNotesMatch = b.notes.some(n => n.text.includes(searchTerm)) ? 1 : 0;

      // Sort by notes match next
      if (aNotesMatch !== bNotesMatch) return bNotesMatch - aNotesMatch;

      // Use text score as the final tie-breaker
      return (b.score || 0) - (a.score || 0);
    });
  }

  res.json({
    status: "success",
    requestedAt: new Date().toISOString(),
    results: sortedBooks.length,
    data: sortedBooks,
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
  const book = await BookModel.create({ ...req.body, userId: loggedInUserId });

  res.status(201).json({
    status: "success",
    data: book,
  });
});

const updateBook = asyncErrorCatcher(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const loggedInUserId = getLoggedInUserIdFromReq();
  const book = await BookModel.findOneAndUpdate({ _id: id, userId: loggedInUserId }, req.body, {
    new: true,
    runValidators: true,
  });

  res.json({
    status: "success",
    data: book,
  });
});

export { getBooks, getBookById, addBook, updateBook };
