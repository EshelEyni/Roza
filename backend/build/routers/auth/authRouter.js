"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authController_1 = require("../../controllers/auth/authController");
const authGuardsMiddleware_1 = require("../../middlewares/authGuards/authGuardsMiddleware");
const rateLimiterService_1 = require("../../services/rateLimiterService");
const userController_1 = require("../../controllers/user/userController");
const router = express_1.default.Router();
router.get("/login/with-token", authController_1.loginWithToken);
router.patch("/update", authGuardsMiddleware_1.checkUserAuthentication, userController_1.updateLoggedInUser);
router.use(rateLimiterService_1.authRequestLimiter);
router.post("/login", authController_1.login);
router.post("/signup", authController_1.signup);
router.post("/logout", authController_1.logout);
router.patch("/updatePassword", authGuardsMiddleware_1.checkUserAuthentication, authController_1.updatePassword);
router.patch("/resetPassword/:token", authController_1.resetPassword);
exports.default = router;
//# sourceMappingURL=authRouter.js.map