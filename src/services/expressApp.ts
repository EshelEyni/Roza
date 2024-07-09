// shared/sharedAppConfig.ts

import { NextFunction, Request, Response } from "express";
import express from "express";
import helmet from "helmet";
import compression from "compression";
import ExpressMongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import path from "path";
import cookieParser from "cookie-parser";
import cors from "cors";
import { requestLimiter } from "./rateLimiterService";
import { requestSanitizer } from "../middlewares/HTMLSanitizer/HTMLSanitizerMiddleware";
import { setupAsyncLocalStorage } from "../middlewares/setupALS/setupALSMiddleware";
import { requestLogger } from "../middlewares/logger/loggerMiddleware";
import { AppError, errorHandler } from "./error/errorService";

const isProdEnv = process.env.NODE_ENV === "production";

export const createExpressApp = (routers: {
  [path: string]: express.Router;
}): express.Express => {
  const app = express();
  app.set("trust proxy", 1);
  app.use(compression());
  app.use(helmet());
  app.use(cookieParser());
  app.use(express.json({ limit: "15kb" }));

  app.use(requestLimiter);
  app.use(ExpressMongoSanitize());
  app.use(requestSanitizer);
  app.use(
    hpp({
      whitelist: ["date"], // add whitelisted query params here
    })
  );

  // CORS
  if (isProdEnv) {
    app.use(express.static(path.join(path.resolve(), "build", "public")));
  } else {
    const corsOptions = {
      origin: [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://10.0.0.5:5173",
        "http://172.17.32.1:5173/",
        "http://10.0.0.5:5173/",
      ],
      credentials: true,
    };
    app.use(cors(corsOptions));
  }

  app.all("*", setupAsyncLocalStorage);

  if (!isProdEnv) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      requestLogger(req, res, next);
    });
  }

  // Add routers
  for (const [path, router] of Object.entries(routers)) {
    app.use(path, router);
  }

  app.get("/**", (req: Request, res: Response) => {
    res.sendFile(path.join(path.resolve(), "build", "public", "index.html"));
  });

  app.all("*", (req: Request, res: Response, next: NextFunction) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
  });

  app.use(errorHandler);

  return app;
};
