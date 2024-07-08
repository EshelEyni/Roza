import rateLimit from "express-rate-limit";
import { NextFunction, Request, Response } from "express";

const getRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  message: "Too many GET requests, please try again later",
});

const postRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: "Too many POST requests, please try again later",
});

const patchRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: "Too many PATCH requests, please try again later",
});

const putRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: "Too many PATCH requests, please try again later",
});

const deleteRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: "Too many DELETE requests, please try again later",
});

const authRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: "Too many authentication requests, please try again later",
});

const requestLimiter = (req: Request, res: Response, next: NextFunction) => {
  switch (req.method) {
    case "GET":
      getRequestLimiter(req, res, next);
      break;
    case "POST":
      postRequestLimiter(req, res, next);
      break;
    case "PATCH":
      patchRequestLimiter(req, res, next);
      break;
    case "PUT":
      putRequestLimiter(req, res, next);
      break;
    case "DELETE":
      deleteRequestLimiter(req, res, next);
      break;
    default:
      next();
  }
};

export { authRequestLimiter, requestLimiter };

/*
Notes:
- This file is used to limit the number of requests a user can make to the server.
- No Test Cases needed. This is just a Wrapper for express-rate-limit.
*/
