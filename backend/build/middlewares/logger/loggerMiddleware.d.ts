/// <reference types="qs" />
/// <reference types="cookie-parser" />
import { Request, Response, NextFunction } from "express";
export declare const requestLogger: (req: Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>, res: Response<any, Record<string, any>>, next: NextFunction) => void;
