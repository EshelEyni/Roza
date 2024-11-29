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
exports.filterObj = exports.APIFeatures = void 0;
exports.queryEntityExistsById = queryEntityExistsById;
exports.isValidMongoId = isValidMongoId;
exports.validateIds = validateIds;
exports.getUniqueStringIds = getUniqueStringIds;
exports.shuffleArray = shuffleArray;
exports.getIsraeliDate = getIsraeliDate;
exports.getDefaultSlateElement = getDefaultSlateElement;
const mongoose_1 = __importDefault(require("mongoose"));
require("dotenv").config();
const errorService_1 = require("../error/errorService");
const filterObj = (obj, ...allowedFields) => {
    if (allowedFields.length === 0)
        return obj;
    return Object.keys(obj).reduce((newObj, key) => {
        if (allowedFields.includes(key)) {
            newObj[key] = obj[key];
        }
        return newObj;
    }, {});
};
exports.filterObj = filterObj;
class APIFeatures {
    constructor(query, queryString) {
        this.query = query;
        this.queryObj = queryString;
    }
    filter() {
        const queryObj = Object.assign({}, this.queryObj);
        const excludedFields = ["page", "sort", "limit", "fields"];
        excludedFields.forEach(el => delete queryObj[el]);
        const queryStr = JSON.stringify(queryObj).replace(/\b(gte|gt|gte|lte|lt|exists)\b/g, match => `$${match}`);
        this.query = this.query.find(JSON.parse(queryStr));
        return this;
    }
    sort() {
        if (this.queryObj.sort) {
            const sortBy = this.queryObj.sort.split(",").join(" ");
            this.query = this.query.sort(sortBy);
        }
        else {
            this.query = this.query.sort("-createdAt _id");
        }
        return this;
    }
    limitFields() {
        if (this.queryObj.fields) {
            const fields = this.queryObj.fields.split(",").join(" ");
            this.query = this.query.select(fields);
        }
        else {
            this.query = this.query.select("-__v");
        }
        return this;
    }
    paginate() {
        var _a, _b;
        const page = parseInt((_a = this.queryObj.page) !== null && _a !== void 0 ? _a : "1", 10);
        const limit = parseInt((_b = this.queryObj.limit) !== null && _b !== void 0 ? _b : "100", 10);
        const skip = (page - 1) * limit;
        this.query = this.query.skip(skip).limit(limit);
        return this;
    }
    getQuery() {
        return this.query;
    }
}
exports.APIFeatures = APIFeatures;
function queryEntityExistsById(model, query) {
    return __awaiter(this, void 0, void 0, function* () {
        return !!(yield model.exists(query).setOptions({ skipHooks: true }).exec());
    });
}
function isValidMongoId(id) {
    return mongoose_1.default.Types.ObjectId.isValid(id);
}
function validateIds(...idEntities) {
    idEntities.forEach(({ id, entityName }) => {
        const statusCode = entityName === "loggedInUser" ? 401 : 400;
        if (!id)
            throw new errorService_1.AppError(`No ${entityName} id provided`, statusCode);
        if (!isValidMongoId(id))
            throw new errorService_1.AppError(`Invalid ${entityName} id: ${id}`, statusCode);
    });
}
function getUniqueStringIds(ids) {
    return [...new Set(ids.map(id => id.toString()))];
}
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]]; // Swap elements
    }
    return array;
}
function getIsraeliDate() {
    const now = new Date();
    const localTime = now.getTime();
    const localOffset = now.getTimezoneOffset() * 60000; // local offset in milliseconds
    const utc = localTime + localOffset;
    const israelOffset = 3 * 60 * 60000; // Israel's UTC offset in milliseconds
    const israelTime = new Date(utc + israelOffset);
    return israelTime;
}
function getDefaultSlateElement(text = "") {
    return [{ type: "paragraph", children: [{ text }] }];
}
//# sourceMappingURL=utilService.js.map