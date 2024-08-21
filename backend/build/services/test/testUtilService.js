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
exports.createTestBookReviews = exports.createTestBookReview = exports.createTestBooks = exports.createTestBook = exports.deleteTestUser = exports.getMockedUser = exports.getMongoId = exports.createValidUserCreds = exports.createTestUser = exports.deleteManyTestUsers = exports.createManyTestUsers = exports.mockGetLoggedInUserIdFromReq = exports.getLoginTokenStrForTest = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
require("dotenv").config();
const mongoose_1 = __importDefault(require("mongoose"));
const tokenService_1 = __importDefault(require("../token/tokenService"));
const userModel_1 = require("../../models/user/userModel");
const ALSService_1 = require("../ALSService");
function createManyTestUsers(numOfUsers) {
    return __awaiter(this, void 0, void 0, function* () {
        const ids = Array.from({ length: numOfUsers }, () => getMongoId());
        yield userModel_1.UserModel.deleteMany({ _id: { $in: ids } });
        const userCreds = ids.map(id => createValidUserCreds(id));
        const users = yield userModel_1.UserModel.create(userCreds).then(docs => docs.map(doc => doc.toObject()));
        return users;
    });
}
exports.createManyTestUsers = createManyTestUsers;
function deleteManyTestUsers(ids) {
    return __awaiter(this, void 0, void 0, function* () {
        yield userModel_1.UserModel.deleteMany({ _id: { $in: ids } });
    });
}
exports.deleteManyTestUsers = deleteManyTestUsers;
function createTestUser({ id, isAdmin = false } = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        const validId = id || getMongoId();
        yield userModel_1.UserModel.findByIdAndDelete(validId).setOptions({ active: false });
        const user = createValidUserCreds(validId);
        if (isAdmin)
            user.roles = ["admin"];
        return (yield userModel_1.UserModel.create(user)).toObject();
    });
}
exports.createTestUser = createTestUser;
function deleteTestUser(id) {
    return __awaiter(this, void 0, void 0, function* () {
        yield userModel_1.UserModel.findByIdAndDelete(id).setOptions({ active: false });
    });
}
exports.deleteTestUser = deleteTestUser;
function getMongoId() {
    return new mongoose_1.default.Types.ObjectId().toHexString();
}
exports.getMongoId = getMongoId;
function createValidUserCreds(id) {
    function makeId(length = 10) {
        let txt = "";
        const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for (let i = 0; i < length; i++) {
            txt += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return txt;
    }
    const username = "testUser_" + makeId();
    const password = "password";
    return {
        _id: id || getMongoId(),
        username: username,
        fullname: "Test User",
        email: `${username}@testemail.com`,
        password,
        passwordConfirm: password,
        weight: 120,
        height: 180,
        gender: "male",
        birthdate: new Date("1990-01-01"),
    };
}
exports.createValidUserCreds = createValidUserCreds;
function getLoginTokenStrForTest(validUserId) {
    const token = tokenService_1.default.signToken(validUserId);
    return `loginToken=${token}`;
}
exports.getLoginTokenStrForTest = getLoginTokenStrForTest;
function getMockedUser({ id, } = {}) {
    return {
        _id: (id === null || id === void 0 ? void 0 : id.toString()) || getMongoId(),
        username: "test1",
        email: "email@email.com",
        fullname: "fullname1",
        imgUrl: "imgUrl1",
        isApprovedLocation: true,
        active: true,
        toObject: jest.fn().mockReturnThis(),
    };
}
exports.getMockedUser = getMockedUser;
function mockGetLoggedInUserIdFromReq(value) {
    const userId = value !== undefined ? value : getMongoId();
    ALSService_1.getLoggedInUserIdFromReq.mockReturnValue(userId);
    return userId;
}
exports.mockGetLoggedInUserIdFromReq = mockGetLoggedInUserIdFromReq;
function createTestBook({ userId, name, chapters, characters, themes, plotlines, notes, filterBy, createdAt, updatedAt, } = {}) {
    return {
        id: getMongoId(),
        userId: userId || getMongoId(),
        name: name || "Test Book",
        chapters: chapters || [],
        characters: characters || [],
        themes: themes || [],
        plotlines: plotlines || [],
        notes: notes || [],
        filterBy: filterBy || "chapters",
        createdAt: createdAt || new Date(),
        updatedAt: updatedAt || new Date(),
        isArchived: false,
        isReadMode: false,
    };
}
exports.createTestBook = createTestBook;
function createTestBooks({ num, userId }) {
    return Array.from({ length: num }).map((_, i) => createTestBook({
        name: `Test Book ${i + 1}`,
        userId,
    }));
}
exports.createTestBooks = createTestBooks;
function createTestBookReview({ id, userId, name, reviews, references, sortOrder, createdAt, updatedAt, } = {}) {
    return {
        id: id || getMongoId(),
        userId: userId || getMongoId(),
        name: name || "Test Book Review",
        reviews: reviews || [],
        references: references || [],
        sortOrder: sortOrder || 0,
        createdAt: createdAt || new Date(),
        updatedAt: updatedAt || new Date(),
        isArchived: false,
        structure: [],
    };
}
exports.createTestBookReview = createTestBookReview;
function createTestBookReviews({ num, userId }) {
    return Array.from({ length: num }).map((_, i) => createTestBookReview({
        userId,
        name: `Test Book Review ${i + 1}`,
    }));
}
exports.createTestBookReviews = createTestBookReviews;
//# sourceMappingURL=testUtilService.js.map