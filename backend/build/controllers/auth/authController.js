"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePassword = exports.resetPassword = exports.logout = exports.signup = exports.loginWithToken = exports.login = void 0;
const authService_1 = __importDefault(require("../../services/auth/authService"));
const errorService_1 = require("../../services/error/errorService");
const ALSService_1 = require("../../services/ALSService");
const login = (0, errorService_1.asyncErrorCatcher)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password } = req.body;
    if (!username || !password)
        throw new errorService_1.AppError("Username and password are required", 400);
    const { user, token } = yield authService_1.default.login(username, password);
    _sendUserTokenSuccessResponse(res, token, user);
}));
exports.login = login;
const loginWithToken = (0, errorService_1.asyncErrorCatcher)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const sendProdFailedResponse = () => {
        res.send({
            status: "success",
            data: null,
        });
    };
    try {
        const { loginToken } = req.cookies;
        if (!loginToken)
            throw new errorService_1.AppError("You are not logged in", 401);
        const { user, token } = yield authService_1.default.loginWithToken(loginToken);
        _sendUserTokenSuccessResponse(res, token, user);
    }
    catch (err) {
        const isProdEnv = process.env.NODE_ENV === "production";
        if (!isProdEnv)
            throw err;
        return sendProdFailedResponse();
    }
}));
exports.loginWithToken = loginWithToken;
const signup = (0, errorService_1.asyncErrorCatcher)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userCreds = req.body;
    const { isValid, msg } = _validateUserCreds(userCreds);
    if (!isValid)
        throw new errorService_1.AppError(msg, 400);
    const { user, token } = yield authService_1.default.signup(userCreds);
    _sendUserTokenSuccessResponse(res, token, user, 201);
}));
exports.signup = signup;
const logout = (0, errorService_1.asyncErrorCatcher)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.clearCookie("loginToken");
    res.send({
        status: "success",
        data: {
            msg: "Logged out successfully",
        },
    });
}));
exports.logout = logout;
const updatePassword = (0, errorService_1.asyncErrorCatcher)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { currentPassword, newPassword, newPasswordConfirm } = req.body;
    for (const field of ["currentPassword", "newPassword", "newPasswordConfirm"])
        if (!req.body[field])
            throw new errorService_1.AppError(`${field} is required`, 400);
    if (newPassword !== newPasswordConfirm)
        throw new errorService_1.AppError("Passwords do not match", 400);
    const loggedInUserId = (0, ALSService_1.getLoggedInUserIdFromReq)();
    if (!loggedInUserId)
        throw new errorService_1.AppError("You are not logged in", 401);
    const { user, token } = yield authService_1.default.updatePassword(loggedInUserId, currentPassword, newPassword, newPasswordConfirm);
    _sendUserTokenSuccessResponse(res, token, user);
}));
exports.updatePassword = updatePassword;
const resetPassword = (0, errorService_1.asyncErrorCatcher)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { token } = req.params;
    const { password, passwordConfirm } = req.body;
    for (const field of ["password", "passwordConfirm"])
        if (!req.body[field])
            throw new errorService_1.AppError(`${field} is required`, 400);
    const { user, token: newToken } = yield authService_1.default.resetPassword(token, password, passwordConfirm);
    _sendUserTokenSuccessResponse(res, newToken, user);
}));
exports.resetPassword = resetPassword;
const _sendUserTokenSuccessResponse = (res, token, user, status = 200) => {
    const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;
    res.cookie("loginToken", token, {
        expires: new Date(Date.now() + NINETY_DAYS),
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        // secure: true,
        // sameSite: "none",
    });
    res.status(status).send({
        status: "success",
        token,
        data: user,
    });
};
const _validateUserCreds = (userCreds) => {
    const requiredFields = [
        "username",
        "password",
        "passwordConfirm",
        "email",
        "fullname",
    ];
    const isUserCredsEmpty = Object.keys(userCreds).length === 0;
    if (isUserCredsEmpty)
        return { isValid: false, msg: "User credentials are required" };
    for (const field of requiredFields)
        if (!userCreds[field])
            return { isValid: false, msg: `${field} is required` };
    return { isValid: true, msg: "" };
};
//# sourceMappingURL=authController.js.map