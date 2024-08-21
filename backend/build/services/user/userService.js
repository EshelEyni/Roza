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
Object.defineProperty(exports, "__esModule", { value: true });
const userModel_1 = require("../../models/user/userModel");
const utilService_1 = require("../../services/util/utilService");
const errorService_1 = require("../../services/error/errorService");
const loggerService_1 = require("../../services/logger/loggerService");
function query(queryString) {
    return __awaiter(this, void 0, void 0, function* () {
        const features = new utilService_1.APIFeatures(userModel_1.UserModel.find(), queryString)
            .filter()
            .sort()
            .limitFields()
            .paginate();
        const users = (yield features.getQuery().exec());
        return users;
    });
}
function getUsers(...userIds) {
    return __awaiter(this, void 0, void 0, function* () {
        const users = yield userModel_1.UserModel.find({ _id: { $in: userIds } })
            .lean()
            .exec();
        return users;
    });
}
function getById(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = yield userModel_1.UserModel.findById(userId).exec();
        if (!user)
            throw new errorService_1.AppError(`User with id ${userId} not found`, 404);
        return user;
    });
}
function getByUsername(username) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = yield userModel_1.UserModel.findOne({ username }).exec();
        if (!user)
            throw new errorService_1.AppError(`User with username ${username} not found`, 404);
        return user;
    });
}
function add(user) {
    return __awaiter(this, void 0, void 0, function* () {
        const savedUser = yield new userModel_1.UserModel(user).save();
        return savedUser;
    });
}
function update(id, user) {
    return __awaiter(this, void 0, void 0, function* () {
        const allowedFields = [
            "username",
            "email",
            "fullname",
            "email",
            "lastVisitedPage",
        ];
        const filteredUser = (0, utilService_1.filterObj)(user, ...allowedFields);
        const updatedUser = yield userModel_1.UserModel.findByIdAndUpdate(id, filteredUser, {
            new: true,
            runValidators: true,
        }).exec();
        if (!updatedUser)
            throw new errorService_1.AppError("User not found", 404);
        return updatedUser;
    });
}
function remove(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const userRemoved = yield userModel_1.UserModel.findByIdAndDelete(userId).exec();
        return userRemoved;
    });
}
function removeAccount(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const removedUser = (yield userModel_1.UserModel.findByIdAndUpdate(userId, {
            active: false,
        }).exec());
        if (!removedUser)
            throw new errorService_1.AppError("User not found", 404);
        loggerService_1.logger.warn(`User ${removedUser.username} was deactivated`);
        return removedUser;
    });
}
exports.default = {
    query,
    getById,
    getByUsername,
    add,
    update,
    remove,
    removeAccount,
    getUsers,
};
//# sourceMappingURL=userService.js.map