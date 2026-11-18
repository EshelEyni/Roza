import type { Request, Response } from "express";
export declare const getAudiobookConfig: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const saveAudiobookNarrator: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const createAudiobookChunk: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const createAudiobookPreview: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const getAudiobookAudio: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const cancelAudiobookRequest: (req: Request, res: Response, next: import("express").NextFunction) => void;
