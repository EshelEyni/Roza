require("dotenv").config();
import app from "./app";
import { startServer } from "@rozaeyni/common";

const port = 3000;
const name = "Auth";

startServer({ app, port, name });
