import { Model } from "mongoose";
import { NextFunction, Request, Response } from "express";
declare const getAll: <T>(model: Model<T>) => (req: Request, res: Response, next: NextFunction) => void;
declare const getOne: <T>(model: Model<T>, popOptions?: string) => (req: Request, res: Response, next: NextFunction) => void;
declare const createOne: <T>(model: Model<T>) => (req: Request, res: Response, next: NextFunction) => void;
declare const updateOne: <T>(model: Model<T>, allowedFields?: string[]) => (req: Request, res: Response, next: NextFunction) => void;
declare const deleteOne: <T>(model: Model<T>) => (req: Request, res: Response, next: NextFunction) => void;
export { getAll, getOne, createOne, updateOne, deleteOne };
