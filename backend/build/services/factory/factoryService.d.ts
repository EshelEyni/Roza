/// <reference types="qs" />
/// <reference types="cookie-parser" />
/// <reference types="mongoose/types/aggregate" />
/// <reference types="mongoose/types/callback" />
/// <reference types="mongoose/types/collection" />
/// <reference types="mongoose/types/connection" />
/// <reference types="mongoose/types/cursor" />
/// <reference types="mongoose/types/document" />
/// <reference types="mongoose/types/error" />
/// <reference types="mongoose/types/expressions" />
/// <reference types="mongoose/types/helpers" />
/// <reference types="mongoose/types/middlewares" />
/// <reference types="mongoose/types/indexes" />
/// <reference types="mongoose/types/models" />
/// <reference types="mongoose/types/mongooseoptions" />
/// <reference types="mongoose/types/pipelinestage" />
/// <reference types="mongoose/types/populate" />
/// <reference types="mongoose/types/query" />
/// <reference types="mongoose/types/schemaoptions" />
/// <reference types="mongoose/types/schematypes" />
/// <reference types="mongoose/types/session" />
/// <reference types="mongoose/types/types" />
/// <reference types="mongoose/types/utility" />
/// <reference types="mongoose/types/validation" />
/// <reference types="mongoose/types/virtuals" />
/// <reference types="mongoose/types/inferschematype" />
/// <reference types="mongoose/types/inferrawdoctype" />
import { Model } from "mongoose";
import { NextFunction, Request, Response } from "express";
declare const getAll: <T>(model: Model<T, {}, {}, {}, import("mongoose").IfAny<T, any, import("mongoose").Document<unknown, {}, T> & import("mongoose").Require_id<T>>, any>) => (req: Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>, res: Response<any, Record<string, any>>, next: NextFunction) => void;
declare const getOne: <T>(model: Model<T, {}, {}, {}, import("mongoose").IfAny<T, any, import("mongoose").Document<unknown, {}, T> & import("mongoose").Require_id<T>>, any>, popOptions?: string) => (req: Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>, res: Response<any, Record<string, any>>, next: NextFunction) => void;
declare const createOne: <T>(model: Model<T, {}, {}, {}, import("mongoose").IfAny<T, any, import("mongoose").Document<unknown, {}, T> & import("mongoose").Require_id<T>>, any>) => (req: Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>, res: Response<any, Record<string, any>>, next: NextFunction) => void;
declare const updateOne: <T>(model: Model<T, {}, {}, {}, import("mongoose").IfAny<T, any, import("mongoose").Document<unknown, {}, T> & import("mongoose").Require_id<T>>, any>, allowedFields?: string[]) => (req: Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>, res: Response<any, Record<string, any>>, next: NextFunction) => void;
declare const deleteOne: <T>(model: Model<T, {}, {}, {}, import("mongoose").IfAny<T, any, import("mongoose").Document<unknown, {}, T> & import("mongoose").Require_id<T>>, any>) => (req: Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>, res: Response<any, Record<string, any>>, next: NextFunction) => void;
export { getAll, getOne, createOne, updateOne, deleteOne };
