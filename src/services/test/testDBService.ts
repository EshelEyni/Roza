/* eslint-disable no-console */
import mongoose from "mongoose";
import { AppError } from "../error/errorService";
import ansiColors from "ansi-colors";
require("dotenv").config();

async function connectToTestDB({ isRemoteDB = false } = {}) {
  try {
    const { DB_URL, TEST_DB_NAME, LOCAL_DB_URL } = process.env;
    if (!LOCAL_DB_URL) throw new AppError("LOCAL_DB_URL is not defined.", 500);
    if (!DB_URL) throw new AppError("DB_URL is not defined.", 500);
    if (!TEST_DB_NAME) throw new AppError("TEST_DB_NAME is not defined.", 500);

    if (isRemoteDB) await mongoose.connect(DB_URL, { dbName: TEST_DB_NAME });
    else await mongoose.connect(LOCAL_DB_URL);

    console.log(ansiColors.bgGreen("Connected to DB"));
  } catch (error) {
    console.log(ansiColors.bgRed("Error connecting to DB"));
    throw error;
  }
}

async function disconnectFromTestDB() {
  await mongoose.connection.close();
  // eslint-disable-next-line no-console
  console.log(ansiColors.red.italic("Disconnected from DB"));
}

export { connectToTestDB, disconnectFromTestDB };
