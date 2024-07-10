// shared/serverSetup.ts

import mongoose from "mongoose";
import { Express } from "express";
import { AppError } from "./error/errorService";
import { logger } from "./logger/loggerService";

type StartServerParams = {
  name: string;
  port: number;
  app: Express;
};

export const startServer = ({ name, port, app }: StartServerParams) => {
  const { DB_URL, NODE_ENV, PROD_DB_NAME, DEV_DB_NAME, TEST_DB_NAME } =
    process.env;

  if (!DB_URL) throw new AppError("DB_URL is not defined.", 500);

  const dbName = getDBName(NODE_ENV, PROD_DB_NAME, DEV_DB_NAME, TEST_DB_NAME);

  mongoose
    .connect(DB_URL, { dbName })
    .then(() => {
      logger.info("Connected to MongoDB.");
    })
    .catch((error) => {
      logger.error("Failed to connect to MongoDB:", error);
    });

  const server = app.listen(port, () => {
    logger.info(`${name} server is running on port: ${port}`);
  });

  process.on("uncaughtException", (err: Error) => {
    logger.error("Uncaught exception:", err.name, err.message);
    process.exit(1);
  });

  process.on("unhandledRejection", (err: Error) => {
    logger.error("Unhandled rejection:", err);
    server.close(() => {
      process.exit(1);
    });
  });

  function getDBName(
    env: string | undefined,
    prodDbName: string | undefined,
    devDbName: string | undefined,
    testDbName: string | undefined
  ): string {
    switch (env) {
      case "production":
        return prodDbName as string;
      case "development":
        return devDbName as string;
      case "test":
        return testDbName as string;
      default:
        throw new AppError("NODE_ENV is not defined.", 500);
    }
  }
};
