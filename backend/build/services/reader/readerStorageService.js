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
exports.getReaderBucket = getReaderBucket;
exports.saveReaderFile = saveReaderFile;
exports.removeReaderFile = removeReaderFile;
const mongoose_1 = __importDefault(require("mongoose"));
const stream_1 = require("stream");
const promises_1 = require("stream/promises");
const errorService_1 = require("../error/errorService");
function getReaderBucket() {
    if (!mongoose_1.default.connection.db)
        throw new errorService_1.AppError("Database is unavailable.", 503);
    return new mongoose_1.default.mongo.GridFSBucket(mongoose_1.default.connection.db, { bucketName: "reader_files" });
}
function saveReaderFile(buffer, filename, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const bucket = getReaderBucket();
        const upload = bucket.openUploadStream(filename, { metadata: { userId } });
        try {
            yield (0, promises_1.pipeline)(stream_1.Readable.from(buffer), upload);
            return upload.id;
        }
        catch (error) {
            yield upload.abort().catch(() => undefined);
            throw error;
        }
    });
}
function removeReaderFile(id) {
    return __awaiter(this, void 0, void 0, function* () {
        yield getReaderBucket().delete(id);
    });
}
//# sourceMappingURL=readerStorageService.js.map