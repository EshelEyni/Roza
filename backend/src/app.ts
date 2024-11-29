import { NextFunction, Request, Response } from "express";
require("dotenv").config();
import express from "express";
import helmet from "helmet";
import compression from "compression";
import ExpressMongoSanitize from "express-mongo-sanitize";
import requestSanitizer from "./middlewares/HTMLSanitizer/HTMLSanitizerMiddleware";
import hpp from "hpp";
import path from "path";
import cookieParser from "cookie-parser";
import cors from "cors";
import { requestLogger } from "./middlewares/logger/loggerMiddleware";
import { AppError, errorHandler } from "./services/error/errorService";
import setupAsyncLocalStorage from "./middlewares/setupALS/setupALSMiddleware";
import userRouter from "./routers/user/userRouter";
import authRouter from "./routers/auth/authRouter";
import bookRouter from "./routers/book/bookRouter";
import bookReviewRouter from "./routers/bookReview/bookReviewRouter";
import { requestLimiter } from "./services/rateLimiterService";

const isProdEnv = process.env.NODE_ENV === "production";

const app = express();
app.use(compression());

app.use(helmet());
app.use(
  helmet.contentSecurityPolicy({
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "img-src": ["'self'", "https:", "data:"],
      "connect-src": ["'self'", "https://api.cloudinary.com"],
      "script-src": ["'self'", "'unsafe-inline'"], // Only if needed
      "style-src": ["'self'", "'unsafe-inline'"], // Only if needed
    },
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: "5000kb" }));

app.use(requestLimiter);
app.use(ExpressMongoSanitize());
app.use(requestSanitizer);
app.use(
  hpp({
    whitelist: ["date"], // add whitelisted query params here
  }),
);

// cors
if (isProdEnv) {
  app.use(express.static(path.join(path.resolve(), "build", "public")));
} else {
  const corsOptions = {
    origin: ["http://127.0.0.1:5173", "http://localhost:5173", "http://10.0.0.5:5173"],
    credentials: true,
  };
  app.use(cors(corsOptions));
}

app.all("*", setupAsyncLocalStorage);

if (!isProdEnv)
  app.use((req: Request, res: Response, next: NextFunction) => {
    requestLogger(req, res, next);
  });

app.use("/api/user", userRouter);
app.use("/api/auth", authRouter);
app.use("/api/book", bookRouter);
app.use("/api/book-review", bookReviewRouter);

app.get("/**", (req: Request, res: Response) => {
  res.sendFile(path.join(path.resolve(), "build", "public", "index.html"));
});

app.all("*", (req: Request, res: Response, next: NextFunction) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(errorHandler);

export default app;
