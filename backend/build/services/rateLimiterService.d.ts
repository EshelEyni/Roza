import { NextFunction, Request, Response } from "express";
declare const authRequestLimiter: import("express-rate-limit").RateLimitRequestHandler;
declare const requestLimiter: (req: Request, res: Response, next: NextFunction) => void;
export { authRequestLimiter, requestLimiter };
