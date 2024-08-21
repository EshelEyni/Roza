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
exports.deleteOne = exports.updateOne = exports.createOne = exports.getOne = exports.getAll = void 0;
const utilService_1 = require("../util/utilService");
const errorService_1 = require("../error/errorService");
const loggerService_1 = require("../logger/loggerService");
const getAll = (model) => (0, errorService_1.asyncErrorCatcher)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const features = new utilService_1.APIFeatures(model.find(), req.query)
        .filter()
        .sort()
        .limitFields()
        .paginate();
    const docs = yield features.getQuery();
    res.json({
        status: "success",
        requestedAt: new Date().toISOString(),
        results: docs.length,
        data: docs,
    });
}));
exports.getAll = getAll;
const getOne = (model, popOptions) => (0, errorService_1.asyncErrorCatcher)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { collectionName } = model.collection;
    const dataName = _getDataName(collectionName);
    const { id } = req.params;
    (0, utilService_1.validateIds)({ id, entityName: dataName });
    const query = model.findById(id);
    if (popOptions)
        query.populate(popOptions);
    const doc = yield query.exec();
    if (!doc)
        throw new errorService_1.AppError(`No ${dataName} was found with the id: ${id}`, 404);
    res.json({
        status: "success",
        data: doc,
    });
}));
exports.getOne = getOne;
const createOne = (model) => (0, errorService_1.asyncErrorCatcher)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const doc = yield model.create(req.body);
    res.status(201).json({
        status: "success",
        data: doc,
    });
}));
exports.createOne = createOne;
const updateOne = (model, allowedFields) => (0, errorService_1.asyncErrorCatcher)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { collectionName } = model.collection;
    const dataName = _getDataName(collectionName);
    const { id } = req.params;
    (0, utilService_1.validateIds)({ id, entityName: dataName });
    (0, errorService_1.validatePatchRequestBody)(req.body);
    if (allowedFields)
        for (const key in req.body)
            if (!allowedFields.includes(key))
                delete req.body[key];
    const doc = yield model.findByIdAndUpdate(id, req.body, {
        new: true,
        runValidators: true,
    });
    if (!doc)
        throw new errorService_1.AppError(`No ${dataName} was found with the id: ${id}`, 404);
    res.json({
        status: "success",
        data: doc,
    });
}));
exports.updateOne = updateOne;
const deleteOne = (model) => (0, errorService_1.asyncErrorCatcher)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { collectionName } = model.collection;
    const dataName = _getDataName(collectionName);
    const { id } = req.params;
    (0, utilService_1.validateIds)({ id, entityName: dataName });
    const doc = yield model.findByIdAndDelete(id);
    if (!doc)
        throw new errorService_1.AppError(`No ${dataName} was found with the id: ${id}`, 404);
    loggerService_1.logger.warn(`Deleted ${dataName} with id: ${id}`);
    res.status(204).json({
        status: "success",
        data: null,
    });
}));
exports.deleteOne = deleteOne;
function _getDataName(collectionName) {
    const lastLetter = collectionName[collectionName.length - 1].toLocaleLowerCase();
    let dataName = lastLetter === "s" ? collectionName.slice(0, collectionName.length - 1) : collectionName;
    dataName = dataName.replace(/_/g, " ");
    return dataName;
}
//# sourceMappingURL=factoryService.js.map