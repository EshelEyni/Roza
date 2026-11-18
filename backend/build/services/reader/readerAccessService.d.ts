import { Request, Response, NextFunction } from "express";
declare function isReaderEnabled(userId: string): boolean;
declare function checkReaderAccess(_req: Request, _res: Response, next: NextFunction): void;
export { isReaderEnabled, checkReaderAccess };
