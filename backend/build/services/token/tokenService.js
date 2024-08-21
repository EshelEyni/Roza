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
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const errorService_1 = require("../error/errorService");
require("dotenv").config();
function getTokenFromRequest(req) {
    const { cookies } = req;
    const isTokenInHeaders = req.headers.authorization && req.headers.authorization.startsWith("Bearer");
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const tokenFromHeaders = isTokenInHeaders ? req.headers.authorization.split(" ")[1] : null;
    const token = (cookies === null || cookies === void 0 ? void 0 : cookies.loginToken) || tokenFromHeaders;
    return token;
}
function signToken(id) {
    if (!process.env.JWT_SECRET_CODE)
        throw new errorService_1.AppError("jwtSecretCode not found in config", 500);
    if (!process.env.JWT_EXPIRATION_TIME)
        throw new errorService_1.AppError("jwtExpirationTime not found in config", 500);
    const token = jsonwebtoken_1.default.sign({ id }, process.env.JWT_SECRET_CODE, {
        expiresIn: process.env.JWT_EXPIRATION_TIME,
    });
    if (!token)
        throw new errorService_1.AppError("Token not created", 500);
    return token;
}
function verifyToken(token) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (!process.env.JWT_SECRET_CODE)
                throw new errorService_1.AppError("jwtSecretCode not found in config", 500);
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET_CODE);
            const { id, iat } = decoded;
            return { id, timeStamp: iat };
        }
        catch (err) {
            return null;
        }
    });
}
exports.default = { getTokenFromRequest, signToken, verifyToken };
//# sourceMappingURL=tokenService.js.map