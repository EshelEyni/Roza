import { Request, Response } from "express";
declare const chatLimiter: import("express-rate-limit").RateLimitRequestHandler;
declare const listConversations: (req: Request, res: Response, next: import("express").NextFunction) => void;
declare const createConversation: (req: Request, res: Response, next: import("express").NextFunction) => void;
declare const getConversation: (req: Request, res: Response, next: import("express").NextFunction) => void;
declare const deleteConversation: (req: Request, res: Response, next: import("express").NextFunction) => void;
declare const sendMessage: (req: Request, res: Response, next: import("express").NextFunction) => void;
export { chatLimiter, listConversations, createConversation, getConversation, deleteConversation, sendMessage, };
