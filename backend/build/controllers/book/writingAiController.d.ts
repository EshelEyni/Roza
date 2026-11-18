import { Request, Response } from "express";
export declare const editingActions: {
    grammar: string;
    clarity: string;
    flow: string;
    concise: string;
    custom: string;
};
export declare function editingRequest(body: Record<string, unknown>): {
    text: string;
    instructions: string;
};
export declare const editChapterText: (req: Request, res: Response, next: import("express").NextFunction) => void;
