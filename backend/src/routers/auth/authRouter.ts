import express from "express";
import { requireFeature } from "../../middlewares/authGuards/featureAccessMiddleware";
import {
  login,
  loginWithToken,
  signup,
  logout,
  resetPassword,
  updatePassword,
} from "../../controllers/auth/authController";
import { checkUserAuthentication } from "../../middlewares/authGuards/authGuardsMiddleware";
import { authRequestLimiter } from "../../services/rateLimiterService";
import { updateLoggedInUser } from "../../controllers/user/userController";

const router = express.Router();

router.get("/login/with-token", loginWithToken);
router.get("/features/staging-room", checkUserAuthentication, requireFeature("stagingRoom"), featureAvailable);
router.get("/features/local-audiobooks", checkUserAuthentication, requireFeature("localAudiobooks"), featureAvailable);
router.patch("/update", checkUserAuthentication, updateLoggedInUser);

router.use(authRequestLimiter);
router.post("/login", login);
router.post("/signup", signup);
router.post("/logout", logout);
router.patch("/updatePassword", checkUserAuthentication, updatePassword);
router.patch("/resetPassword/:token", resetPassword);

function featureAvailable(_req: express.Request, res: express.Response) {
  res.set("Cache-Control", "private, no-store").sendStatus(204);
}

export default router;
