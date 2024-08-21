"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv").config();
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const express_mongo_sanitize_1 = __importDefault(require("express-mongo-sanitize"));
const HTMLSanitizerMiddleware_1 = __importDefault(require("./middlewares/HTMLSanitizer/HTMLSanitizerMiddleware"));
const hpp_1 = __importDefault(require("hpp"));
const path_1 = __importDefault(require("path"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const loggerMiddleware_1 = require("./middlewares/logger/loggerMiddleware");
const errorService_1 = require("./services/error/errorService");
const setupALSMiddleware_1 = __importDefault(require("./middlewares/setupALS/setupALSMiddleware"));
const userRouter_1 = __importDefault(require("./routers/user/userRouter"));
const authRouter_1 = __importDefault(require("./routers/auth/authRouter"));
const bookRouter_1 = __importDefault(require("./routers/book/bookRouter"));
const bookReviewRouter_1 = __importDefault(require("./routers/bookReview/bookReviewRouter"));
const rateLimiterService_1 = require("./services/rateLimiterService");
const isProdEnv = process.env.NODE_ENV === "production";
const app = (0, express_1.default)();
app.use((0, compression_1.default)());
app.use((0, helmet_1.default)());
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json({ limit: "5000kb" }));
app.use(rateLimiterService_1.requestLimiter);
app.use((0, express_mongo_sanitize_1.default)());
app.use(HTMLSanitizerMiddleware_1.default);
app.use((0, hpp_1.default)({
    whitelist: ["date"], // add whitelisted query params here
}));
// cors
if (isProdEnv) {
    app.use(express_1.default.static(path_1.default.join(path_1.default.resolve(), "build", "public")));
}
else {
    const corsOptions = {
        origin: ["http://127.0.0.1:5173", "http://localhost:5173", "http://10.0.0.5:5173"],
        credentials: true,
    };
    app.use((0, cors_1.default)(corsOptions));
}
app.all("*", setupALSMiddleware_1.default);
if (!isProdEnv)
    app.use((req, res, next) => {
        (0, loggerMiddleware_1.requestLogger)(req, res, next);
    });
app.use("/api/user", userRouter_1.default);
app.use("/api/auth", authRouter_1.default);
app.use("/api/book", bookRouter_1.default);
app.use("/api/book-review", bookReviewRouter_1.default);
app.get("/**", (req, res) => {
    res.sendFile(path_1.default.join(path_1.default.resolve(), "build", "public", "index.html"));
});
app.all("*", (req, res, next) => {
    next(new errorService_1.AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});
app.use(errorService_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map