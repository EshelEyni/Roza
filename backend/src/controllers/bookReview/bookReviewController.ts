import { BookReviewModel } from "../../models/bookReview/bookReviewModel";
import { NextFunction, Request, Response } from "express";
import { AppError, asyncErrorCatcher } from "../../services/error/errorService";
import { getLoggedInUserIdFromReq } from "../../services/ALSService";
import { BookReview } from "../../../../shared/types/books";

// interface BookwReviewWithScore extends BookReview {
//   score: number;
// }

const getBookReviews = asyncErrorCatcher(
  async (req: Request, res: Response, next: NextFunction) => {
    const loggedInUserId = getLoggedInUserIdFromReq();
    if (!loggedInUserId) return next(new AppError("User not logged in", 401));
    const { limit, sort, searchTerm } = req.query;

    const query = BookReviewModel.find({ userId: loggedInUserId, isArchived: false })
      .limit(limit ? parseInt(limit.toString()) : 10)
      .sort(sort ? sort.toString() : "sortOrder");

    if (searchTerm) {
      query.find({ $text: { $search: searchTerm.toString() } }, { score: { $meta: "textScore" } });
      query.sort({ score: { $meta: "textScore" } });
    }

    const reviews = (await query.exec()) as unknown as BookReview[];

    // let sortedReviews = reviews;
    // if (searchTerm && typeof searchTerm === "string") {
    //   sortedReviews = (reviews as BookwReviewWithScore[]).sort((a, b) => {
    //     const aNameMatch = a.name.includes(searchTerm) ? 1 : 0;
    //     const bNameMatch = b.name.includes(searchTerm) ? 1 : 0;

    //     if (aNameMatch !== bNameMatch) return bNameMatch - aNameMatch;

    //     const aReviewsMatch = a.reviews.some(r => r.text.includes(searchTerm)) ? 1 : 0;
    //     const bReviewsMatch = b.reviews.some(r => r.text.includes(searchTerm)) ? 1 : 0;

    //     if (aReviewsMatch !== bReviewsMatch) return bReviewsMatch - aReviewsMatch;

    //     return b.score - a.score;
    //   });
    // }

    res.json({
      status: "success",
      requestedAt: new Date().toISOString(),
      results: reviews.length,
      data: reviews,
    });
  },
);

const getBookReviewById = asyncErrorCatcher(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const loggedInUserId = getLoggedInUserIdFromReq();

    const review = await BookReviewModel.findOne({
      _id: id,
      userId: loggedInUserId,
      isArchived: false,
    });

    if (!review) return next(new AppError("Review not found", 404));

    res.json({
      status: "success",
      data: review,
    });
  },
);

const addBookReview = asyncErrorCatcher(async (req: Request, res: Response, next: NextFunction) => {
  const loggedInUserId = getLoggedInUserIdFromReq();
  const review = await BookReviewModel.create({ ...req.body, userId: loggedInUserId });
  res.status(201).json({
    status: "success",
    data: review,
  });
});

const updateBookReview = asyncErrorCatcher(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const loggedInUserId = getLoggedInUserIdFromReq();
    const review = await BookReviewModel.findOneAndUpdate(
      { _id: id, userId: loggedInUserId },
      req.body,
      {
        new: true,
        runValidators: true,
      },
    );

    if (!review) return next(new AppError("Review not found", 404));

    res.json({
      status: "success",
      data: review,
    });
  },
);

export { getBookReviews, getBookReviewById, addBookReview, updateBookReview };
