require("dotenv").config();
import { createExpressApp } from "@rozaeyni/common";
import authRouter from "./api/auth/router/authRouter";
import userRouter from "./api/user/router/userRouter";

const routers = {
  "/api/auth": authRouter,
  "/api/user": userRouter,
};

const app = createExpressApp(routers);

export default app;
