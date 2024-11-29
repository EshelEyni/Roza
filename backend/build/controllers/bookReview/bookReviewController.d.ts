import { NextFunction, Request, Response } from "express";
declare const getBookReviews: (req: Request, res: Response, next: NextFunction) => void;
declare const getBookReviewById: (req: Request, res: Response, next: NextFunction) => void;
declare const addBookReview: (req: Request, res: Response, next: NextFunction) => void;
declare const updateBookReview: (req: Request, res: Response, next: NextFunction) => void;
export { getBookReviews, getBookReviewById, addBookReview, updateBookReview };
