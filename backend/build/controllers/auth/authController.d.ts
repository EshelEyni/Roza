import { Request, Response } from "express";
declare const login: (req: Request, res: Response, next: import("express").NextFunction) => void;
declare const loginWithToken: (req: Request, res: Response, next: import("express").NextFunction) => void;
declare const signup: (req: Request, res: Response, next: import("express").NextFunction) => void;
declare const logout: (req: Request, res: Response, next: import("express").NextFunction) => void;
declare const updatePassword: (req: Request, res: Response, next: import("express").NextFunction) => void;
declare const resetPassword: (req: Request, res: Response, next: import("express").NextFunction) => void;
export { login, loginWithToken, signup, logout, resetPassword, updatePassword };
