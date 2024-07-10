require("dotenv").config();
import app from "./app";
import { startServer } from "@rozaeyni/common";

const isLocalDev = process.env.NODE_ENV === "development";

const port = isLocalDev ? 3020 : 3000;

startServer(app, port);
