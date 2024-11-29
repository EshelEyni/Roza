import { NextFunction, Request, Response } from "express";
declare const getBooks: (req: Request, res: Response, next: NextFunction) => void;
declare const getBookById: (req: Request, res: Response, next: NextFunction) => void;
declare const addBook: (req: Request, res: Response, next: NextFunction) => void;
declare const updateBook: (req: Request, res: Response, next: NextFunction) => void;
export { getBooks, getBookById, addBook, updateBook };
