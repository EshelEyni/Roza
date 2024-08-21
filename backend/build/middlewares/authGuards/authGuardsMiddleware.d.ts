/// <reference types="qs" />
/// <reference types="cookie-parser" />
import { Request, Response, NextFunction } from "express";
declare const checkUserAuthentication: (req: Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>, res: Response<any, Record<string, any>>, next: NextFunction) => void;
declare const checkAdminAuthorization: (req: Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>, res: Response<any, Record<string, any>>, next: NextFunction) => void;
export { checkUserAuthentication, checkAdminAuthorization };
