"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const userController_1 = require("../../controllers/user/userController");
const authGuardsMiddleware_1 = require("../../middlewares/authGuards/authGuardsMiddleware");
const router = express_1.default.Router();
router.use(authGuardsMiddleware_1.checkUserAuthentication);
router.get("/", userController_1.getUsers);
router.get("/:id([a-fA-F0-9]{24})", userController_1.getUserById);
router.get("/username/:username", userController_1.getUserByUsername);
router.patch("/loggedInUser", userController_1.updateLoggedInUser);
router.delete("/loggedInUser", userController_1.removeLoggedInUser);
router.use(authGuardsMiddleware_1.checkAdminAuthorization);
router.post("/", userController_1.addUser);
router.patch("/:id", userController_1.updateUser);
router.delete("/:id", userController_1.removeUser);
exports.default = router;
//# sourceMappingURL=userRouter.js.map