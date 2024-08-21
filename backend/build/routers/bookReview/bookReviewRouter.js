"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bookReviewController_1 = require("../../controllers/bookReview/bookReviewController");
const authGuardsMiddleware_1 = require("../../middlewares/authGuards/authGuardsMiddleware");
const router = express_1.default.Router();
router.use(authGuardsMiddleware_1.checkUserAuthentication);
router.get("/", bookReviewController_1.getBookReviews);
router.get("/:id([a-fA-F0-9]{24})", bookReviewController_1.getBookReviewById);
router.post("/", bookReviewController_1.addBookReview);
router.patch("/:id", bookReviewController_1.updateBookReview);
exports.default = router;
//# sourceMappingURL=bookReviewRouter.js.map