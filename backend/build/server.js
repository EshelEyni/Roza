"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const loggerService_1 = require("./services/logger/loggerService");
process.on("uncaughtException", (err) => {
    loggerService_1.logger.error("Uncaught exception:", err.name, err.message);
    process.exit(1);
});
require("dotenv").config();
const mongoose_1 = __importDefault(require("mongoose"));
const app_1 = __importDefault(require("./app"));
const errorService_1 = require("./services/error/errorService");
const { DB_URL } = process.env;
if (!DB_URL)
    throw new errorService_1.AppError("DB_URL URL is not defined.", 500);
const dbName = getDBName();
mongoose_1.default
    .connect(DB_URL, { dbName })
    .then(() => {
    loggerService_1.logger.info("Connected to MongoDB.");
})
    .catch(error => {
    loggerService_1.logger.error("Failed to connect to MongoDB:", error);
});
const port = 3030;
const server = app_1.default.listen(port, () => {
    loggerService_1.logger.info(`Server is running on port: ${port}`);
});
process.on("unhandledRejection", (err) => {
    loggerService_1.logger.error("Unhandled rejection:", err);
    server.close(() => {
        process.exit(1);
    });
});
function getDBName() {
    const { NODE_ENV, PROD_DB_NAME, DEV_DB_NAME, TEST_DB_NAME } = process.env;
    switch (NODE_ENV) {
        case "production":
            return PROD_DB_NAME;
        case "development":
            return DEV_DB_NAME;
        case "test":
            return TEST_DB_NAME;
        default:
            throw new errorService_1.AppError("NODE_ENV is not defined.", 500);
    }
}
//# sourceMappingURL=server.js.map