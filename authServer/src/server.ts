require("dotenv").config();
import app from "./app";
import { startServer } from "@rozaeyni/common";

const port = 3000;

startServer(app, port);
