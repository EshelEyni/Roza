import { logger } from "../../services/logger/loggerService";

process.on("uncaughtException", (err: Error) => {
  logger.error("Uncaught exception:", err.name, err.message);
  process.exit(1);
});

require("dotenv").config();
import mongoose from "mongoose";
import app from "./app";
import { AppError } from "../../services/error/errorService";

const { DB_URL } = process.env;
if (!DB_URL) throw new AppError("DB_URL URL is not defined.", 500);

const dbName = getDBName();

mongoose
  .connect(DB_URL, { dbName })
  .then(() => {
    logger.info("Connected to MongoDB.");
  })
  .catch(error => {
    logger.error("Failed to connect to MongoDB:", error);
  });

const port = 3030;

const server = app.listen(port, () => {
  logger.info(`Server is running on port: ${port}`);
});

process.on("unhandledRejection", (err: Error) => {
  logger.error("Unhandled rejection:", err);
  server.close(() => {
    process.exit(1);
  });
});

function getDBName(): string {
  const { NODE_ENV, PROD_DB_NAME, DEV_DB_NAME, TEST_DB_NAME } = process.env;

  switch (NODE_ENV) {
    case "production":
      return PROD_DB_NAME as string;
    case "development":
      return DEV_DB_NAME as string;
    case "test":
      return TEST_DB_NAME as string;
    default:
      throw new AppError("NODE_ENV is not defined.", 500);
  }
}
