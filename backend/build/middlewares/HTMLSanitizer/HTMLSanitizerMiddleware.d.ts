/// <reference types="cookie-parser" />
import { Request, Response, NextFunction } from "express";
declare function requestSanitizer(req: Request, res: Response, next: NextFunction): void;
export default requestSanitizer;
