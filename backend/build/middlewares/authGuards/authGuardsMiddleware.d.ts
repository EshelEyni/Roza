import { Request, Response, NextFunction } from "express";
declare const checkUserAuthentication: (req: Request, res: Response, next: NextFunction) => void;
declare const checkAdminAuthorization: (req: Request, res: Response, next: NextFunction) => void;
export { checkUserAuthentication, checkAdminAuthorization };
