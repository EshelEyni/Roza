import { Response, Request, NextFunction } from "express";
type AsyncExpressMiddleware = (req: Request, res: Response, next: NextFunction) => Promise<void>;
interface CustomError extends Error {
    path?: string;
    value?: string;
    keyValue?: {
        [key: string]: string;
    };
    statusCode?: number;
}
declare class AppError extends Error {
    statusCode: number;
    status: string;
    isOperational: boolean;
    code?: number;
    constructor(message: string, statusCode: number, code?: number);
}
declare function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void;
declare function asyncErrorCatcher(fn: AsyncExpressMiddleware): (req: Request, res: Response, next: NextFunction) => void;
declare function validatePatchRequestBody(body: object): void;
export { CustomError, AppError, errorHandler, asyncErrorCatcher, validatePatchRequestBody };
