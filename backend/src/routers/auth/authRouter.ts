import express from "express";
import {
  login,
  loginWithToken,
  signup,
  logout,
  sendPasswordResetEmail,
  resetPassword,
  updatePassword,
} from "../../controllers/auth/authController";
import { checkUserAuthentication } from "../../middlewares/authGuards/authGuardsMiddleware";
import { authRequestLimiter } from "../../services/rateLimiterService";
import { updateLoggedInUser } from "../../controllers/user/userController";

const router = express.Router();

router.get("/login/with-token", loginWithToken);

router.use(authRequestLimiter);
router.post("/login", login);
router.post("/signup", signup);
router.post("/logout", logout);
router.patch("/update", checkUserAuthentication, updateLoggedInUser);
router.patch("/updatePassword", checkUserAuthentication, updatePassword);
router.post("/forgotPassword", sendPasswordResetEmail);
router.patch("/resetPassword/:token", resetPassword);

export default router;
