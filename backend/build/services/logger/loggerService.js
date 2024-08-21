"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
const fs_1 = __importDefault(require("fs"));
const ansi_colors_1 = __importDefault(require("ansi-colors"));
const ALSService_1 = require("../ALSService");
const logsDir = "./logs";
if (!fs_1.default.existsSync(logsDir))
    fs_1.default.mkdirSync(logsDir);
function _handleLogMessage(level, ...args) {
    const isTestEnv = process.env.NODE_ENV === "test";
    if (isTestEnv)
        return;
    const message = _formatLogMessage(level, ...args);
    _writeToLogFile(message);
    _logMessage(level, message);
}
function _formatLogMessage(level, ...args) {
    const text = args
        .map(arg => {
        const _isError = (e) => e instanceof Error && !!e.stack && !!e.message;
        return typeof arg === "string" || _isError(arg) ? arg : JSON.stringify(arg);
    })
        .join(" | ");
    const userId = (0, ALSService_1.getLoggedInUserIdFromReq)();
    const userStr = userId ? `(userId: ${userId})` : "";
    const currTime = new Date().toLocaleString("he");
    return `${currTime} - ${level} - ${text} ${userStr}\n`;
}
function _writeToLogFile(message) {
    fs_1.default.appendFile("./logs/backend.log", message, (err) => {
        if (err)
            console.log(ansi_colors_1.default.red("FATAL: cannot write to log file"));
    });
}
function _logMessage(level, message) {
    let log = message;
    switch (level) {
        case "DEBUG":
            log = ansi_colors_1.default.bgMagenta(message);
            break;
        case "INFO":
            log = ansi_colors_1.default.bgGreen(message);
            break;
        case "SUCCESS":
            log = ansi_colors_1.default.bgBlue(message);
            break;
        case "WARN":
            log = ansi_colors_1.default.bgYellow(message);
            break;
        case "ERROR":
            log = ansi_colors_1.default.bgRed(message);
            break;
    }
    console.log(log);
}
function debug(...args) {
    if (process.env.NODE_NEV === "production")
        return;
    _handleLogMessage("DEBUG", ...args);
}
function info(...args) {
    _handleLogMessage("INFO", ...args);
}
function success(...args) {
    _handleLogMessage("SUCCESS", ...args);
}
function warn(...args) {
    _handleLogMessage("WARN", ...args);
}
function error(...args) {
    _handleLogMessage("ERROR", ...args);
}
exports.logger = {
    debug,
    info,
    success,
    warn,
    error,
};
//# sourceMappingURL=loggerService.js.map