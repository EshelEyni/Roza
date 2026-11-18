"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const writingAiController_1 = require("../../controllers/book/writingAiController");
const bookController_1 = require("../../controllers/book/bookController");
const router = express_1.default.Router();
router.get("/", bookController_1.getBooks);
router.get("/:id([a-fA-F0-9]{24})", bookController_1.getBookById);
router.post("/:id([a-fA-F0-9]{24})/chapters/:chapterId([a-fA-F0-9]{24})/ai-edit", writingAiController_1.editChapterText);
router.post("/", bookController_1.addBook);
router.patch("/:id", bookController_1.updateBook);
exports.default = router;
//# sourceMappingURL=bookRouter.js.map