require("dotenv").config();
import { createExpressApp } from "@rozaeyni/common";
import reviewRouter from "./api/bookReview/router/reviewRouter";

const routers = {
  "/api/book-review": reviewRouter,
};

const app = createExpressApp(routers);

export default app;
