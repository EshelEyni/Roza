import { Request, Response, NextFunction } from "express";
import { getLoggedInUserIdFromReq } from "../ALSService";
import { AppError } from "../error/errorService";

function isReaderEnabled(userId: string): boolean {
  const allowedIds = (process.env.READER_ALLOWED_USER_IDS || "").split(",").map(id => id.trim());
  return process.env.READER_ENABLED === "true" && !!userId && allowedIds.includes(userId);
}

function checkReaderAccess(_req: Request, _res: Response, next: NextFunction) {
  if (!isReaderEnabled(getLoggedInUserIdFromReq()))
    return next(new AppError("Reader is not enabled for this account.", 403));
  next();
}

export { isReaderEnabled, checkReaderAccess };
