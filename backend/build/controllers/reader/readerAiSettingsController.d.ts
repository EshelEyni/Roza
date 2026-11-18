import { Request, Response } from "express";
declare const getAiSettings: (req: Request, res: Response, next: import("express").NextFunction) => void;
declare const updateAiSettings: (req: Request, res: Response, next: import("express").NextFunction) => void;
export { getAiSettings, updateAiSettings };
