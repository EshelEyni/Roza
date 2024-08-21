"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectFromTestDB = exports.connectToTestDB = void 0;
/* eslint-disable no-console */
const mongoose_1 = __importDefault(require("mongoose"));
const errorService_1 = require("../error/errorService");
const ansi_colors_1 = __importDefault(require("ansi-colors"));
require("dotenv").config();
function connectToTestDB({ isRemoteDB = false } = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { DB_URL, TEST_DB_NAME, LOCAL_DB_URL } = process.env;
            if (!LOCAL_DB_URL)
                throw new errorService_1.AppError("LOCAL_DB_URL is not defined.", 500);
            if (!DB_URL)
                throw new errorService_1.AppError("DB_URL is not defined.", 500);
            if (!TEST_DB_NAME)
                throw new errorService_1.AppError("TEST_DB_NAME is not defined.", 500);
            if (isRemoteDB)
                yield mongoose_1.default.connect(DB_URL, { dbName: TEST_DB_NAME });
            else
                yield mongoose_1.default.connect(LOCAL_DB_URL);
            console.log(ansi_colors_1.default.bgGreen("Connected to DB"));
        }
        catch (error) {
            console.log(ansi_colors_1.default.bgRed("Error connecting to DB"));
            throw error;
        }
    });
}
exports.connectToTestDB = connectToTestDB;
function disconnectFromTestDB() {
    return __awaiter(this, void 0, void 0, function* () {
        yield mongoose_1.default.connection.close();
        // eslint-disable-next-line no-console
        console.log(ansi_colors_1.default.red.italic("Disconnected from DB"));
    });
}
exports.disconnectFromTestDB = disconnectFromTestDB;
//# sourceMappingURL=testDBService.js.map