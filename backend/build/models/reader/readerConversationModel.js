"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReaderConversationModel = void 0;
const mongoose_1 = require("mongoose");
const readerConversationSchema_1 = require("./schemas/readerConversationSchema");
const ReaderConversationModel = (0, mongoose_1.model)("ReaderConversation", readerConversationSchema_1.readerConversationSchema, "reader_conversations");
exports.ReaderConversationModel = ReaderConversationModel;
//# sourceMappingURL=readerConversationModel.js.map