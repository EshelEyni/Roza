import { Request } from "express";
declare function getTokenFromRequest(req: Request): any;
declare function signToken(id: string): string;
declare function verifyToken(token: string): Promise<{
    id: string;
    timeStamp: number;
} | null>;
declare const _default: {
    getTokenFromRequest: typeof getTokenFromRequest;
    signToken: typeof signToken;
    verifyToken: typeof verifyToken;
};
export default _default;
