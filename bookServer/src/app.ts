require("dotenv").config();
import { createExpressApp } from "@rozaeyni/common";
import bookRouter from "./api/book/router/bookRouter";

const routers = {
  "/api/book": bookRouter,
};

const app = createExpressApp(routers);

export default app;
