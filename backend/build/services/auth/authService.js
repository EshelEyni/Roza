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
const crypto_1 = __importDefault(require("crypto"));
const userModel_1 = require("../../models/user/userModel");
const errorService_1 = require("../error/errorService");
const utilService_1 = require("../util/utilService");
const tokenService_1 = __importDefault(require("../token/tokenService"));
function login(username, password) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = yield userModel_1.UserModel.findOne({ username }).select("+password");
        if (!user)
            throw new errorService_1.AppError("User not found", 404);
        _checkIsUserLocked(user);
        yield _checkLoginAttempts(user);
        yield _validateUserPassword(user, password);
        yield _resetLoginAttempts(user);
        return { user: user, token: tokenService_1.default.signToken(user.id) };
    });
}
function loginWithToken(loginToken) {
    return __awaiter(this, void 0, void 0, function* () {
        const verifiedToken = yield tokenService_1.default.verifyToken(loginToken);
        if (!verifiedToken)
            throw new errorService_1.AppError("Invalid token", 400);
        const { id } = verifiedToken;
        if (!(0, utilService_1.isValidMongoId)(id))
            throw new errorService_1.AppError("Invalid Id", 400);
        const user = yield userModel_1.UserModel.findById(id);
        if (!user)
            throw new errorService_1.AppError("User not found", 404);
        return { user: user, token: tokenService_1.default.signToken(user.id) };
    });
}
function signup(userCreds) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = yield userModel_1.UserModel.create(userCreds);
        const token = tokenService_1.default.signToken(user.id);
        return { user: user, token };
    });
}
function updatePassword(loggedInUserId, currentPassword, newPassword, newPasswordConfirm) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = yield userModel_1.UserModel.findById(loggedInUserId).select("+password");
        if (!user)
            throw new errorService_1.AppError("User not found", 404);
        if (!(yield user.checkPassword(currentPassword, user.password)))
            throw new errorService_1.AppError("Current password is incorrect. Please enter the correct password", 400);
        (user.password = newPassword), (user.passwordConfirm = newPasswordConfirm);
        yield user.save();
        const token = tokenService_1.default.signToken(user.id);
        return { user: user, token };
    });
}
function resetPassword(token, password, passwordConfirm) {
    return __awaiter(this, void 0, void 0, function* () {
        const hashedToken = crypto_1.default.createHash("sha256").update(token).digest("hex");
        const user = yield userModel_1.UserModel.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() },
        });
        if (!user)
            throw new errorService_1.AppError("Token is invalid or has expired", 400);
        (user.password = password), (user.passwordConfirm = passwordConfirm);
        user.passwordResetToken = user.passwordResetExpires = undefined;
        yield user.save();
        return { user: user, token: tokenService_1.default.signToken(user.id) };
    });
}
function _checkIsUserLocked(user) {
    if ((user === null || user === void 0 ? void 0 : user.lockedUntil) < Date.now())
        return;
    const minutes = Math.ceil((user.lockedUntil - Date.now()) / 1000 / 60);
    throw new errorService_1.AppError(`Account locked. Try again in ${minutes} minutes`, 400);
}
function _validateUserPassword(user, password) {
    return __awaiter(this, void 0, void 0, function* () {
        const isValidPassword = yield user.checkPassword(password, user.password);
        user.loginAttempts++;
        yield user.save({ validateBeforeSave: false });
        if (!isValidPassword)
            throw new errorService_1.AppError("Incorrect password", 401);
    });
}
function _checkLoginAttempts(user) {
    return __awaiter(this, void 0, void 0, function* () {
        if (user.loginAttempts < 10)
            return;
        const HOUR = 60 * 60 * 1000;
        user.lockedUntil = Date.now() + HOUR;
        yield user.save({ validateBeforeSave: false });
        throw new errorService_1.AppError("Too many failed login attempts. Try again in 1 hour", 400);
    });
}
function _resetLoginAttempts(user) {
    return __awaiter(this, void 0, void 0, function* () {
        user.loginAttempts = 0;
        user.lockedUntil = 0;
        yield user.save({ validateBeforeSave: false });
    });
}
exports.default = {
    login,
    loginWithToken,
    signup,
    resetPassword,
    updatePassword,
};
//# sourceMappingURL=authService.js.map