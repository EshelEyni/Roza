/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "fs";
import ansiColors from "ansi-colors";
import { getLoggedInUserIdFromReq } from "../ALSService";

const logsDir = "./logs";
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);

function _handleLogMessage(level: string, ...args: (string | Error | Record<string, unknown>)[]) {
  const isTestEnv = process.env.NODE_ENV === "test";
  if (isTestEnv) return;
  const message = _formatLogMessage(level, ...args);
  _writeToLogFile(message);
  _logMessage(level, message);
}

function _formatLogMessage(
  level: string,
  ...args: (string | Error | Record<string, unknown>)[]
): string {
  const text = args
    .map(arg => {
      const _isError = (e: any): boolean => e instanceof Error && !!e.stack && !!e.message;
      return typeof arg === "string" || _isError(arg) ? arg : JSON.stringify(arg);
    })
    .join(" | ");

  const userId = getLoggedInUserIdFromReq();
  const userStr = userId ? `(userId: ${userId})` : "";
  const currTime = new Date().toLocaleString("he");
  return `${currTime} - ${level} - ${text} ${userStr}\n`;
}

function _writeToLogFile(message: string) {
  fs.appendFile("./logs/backend.log", message, (err: any) => {
    if (err) console.log(ansiColors.red("FATAL: cannot write to log file"));
  });
}

function _logMessage(level: string, message: string) {
  let log = message;
  switch (level) {
    case "DEBUG":
      log = ansiColors.bgMagenta(message);
      break;
    case "INFO":
      log = ansiColors.bgGreen(message);
      break;
    case "SUCCESS":
      log = ansiColors.bgBlue(message);
      break;
    case "WARN":
      log = ansiColors.bgYellow(message);
      break;
    case "ERROR":
      log = ansiColors.bgRed(message);
      break;
  }
  console.log(log);
}

function debug(...args: any[]) {
  if (process.env.NODE_NEV === "production") return;
  _handleLogMessage("DEBUG", ...args);
}

function info(...args: string[]) {
  _handleLogMessage("INFO", ...args);
}

function success(...args: string[]) {
  _handleLogMessage("SUCCESS", ...args);
}

function warn(...args: string[]) {
  _handleLogMessage("WARN", ...args);
}

function error(...args: Array<string | Error>) {
  _handleLogMessage("ERROR", ...args);
}

export const logger = {
  debug,
  info,
  success,
  warn,
  error,
};
