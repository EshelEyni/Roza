import express from "express";
import {
  login,
  loginWithToken,
  signup,
  logout,
  sendPasswordResetEmail,
  resetPassword,
  updatePassword,
} from "../controller/authController";
import { authRequestLimiter, checkUserAuthentication } from "@rozaeyni/common";

const router = express.Router();

router.get("/login/with-token", loginWithToken);

router.use(authRequestLimiter);
router.post("/login", login);
router.post("/signup", signup);
router.post("/logout", logout);
router.patch("/updatePassword", checkUserAuthentication, updatePassword);
router.post("/forgotPassword", sendPasswordResetEmail);
router.patch("/resetPassword/:token", resetPassword);

export default router;
