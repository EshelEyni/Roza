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
exports.checkAdminAuthorization = exports.checkUserAuthentication = void 0;
const errorService_1 = require("../../services/error/errorService");
const userModel_1 = require("../../models/user/userModel");
const tokenService_1 = __importDefault(require("../../services/token/tokenService"));
const utilService_1 = require("../../services/util/utilService");
const ALSService_1 = require("../../services/ALSService");
const checkUserAuthentication = (0, errorService_1.asyncErrorCatcher)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const token = tokenService_1.default.getTokenFromRequest(req);
    if (!token)
        return next(new errorService_1.AppError("You are not logged in! Please log in to get access.", 401));
    const verifiedToken = yield tokenService_1.default.verifyToken(token);
    if (!verifiedToken)
        return next(new errorService_1.AppError("Invalid Token", 401));
    const { id, timeStamp } = verifiedToken;
    if (!(0, utilService_1.isValidMongoId)(id))
        return next(new errorService_1.AppError("Invalid User Id", 401));
    const currentUser = yield userModel_1.UserModel.findById(id).setOptions({ skipHooks: true }).exec();
    if (!currentUser)
        return next(new errorService_1.AppError("The user belonging to this token does not exist.", 401));
    const changedPasswordAfter = currentUser.changedPasswordAfter(timeStamp);
    if (changedPasswordAfter)
        return next(new errorService_1.AppError("User recently changed password! Please log in again.", 401));
    next();
}));
exports.checkUserAuthentication = checkUserAuthentication;
const checkAdminAuthorization = (0, errorService_1.asyncErrorCatcher)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const loggedInUserId = (0, ALSService_1.getLoggedInUserIdFromReq)();
    if (!loggedInUserId)
        return next(new errorService_1.AppError("User not logged in", 401));
    const user = yield userModel_1.UserModel.findById(loggedInUserId).setOptions({ skipHooks: true }).exec();
    if (!user)
        return next(new errorService_1.AppError("User not found", 404));
    if (!user.roles.includes("admin"))
        return next(new errorService_1.AppError("You do not have permission to perform this action", 403));
    next();
}));
exports.checkAdminAuthorization = checkAdminAuthorization;
//# sourceMappingURL=authGuardsMiddleware.js.map