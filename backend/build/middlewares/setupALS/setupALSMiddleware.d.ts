import { Request, Response, NextFunction } from "express";
declare const setupAsyncLocalStorage: (req: Request, res: Response, next: NextFunction) => void;
export default setupAsyncLocalStorage;
