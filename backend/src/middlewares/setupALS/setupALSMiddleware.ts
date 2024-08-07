import { Request, Response, NextFunction } from "express";
import { asyncLocalStorage } from "../../services/ALSService";
import { asyncErrorCatcher } from "../../services/error/errorService";
import tokenService from "../../services/token/tokenService";
import { alStoreType } from "../../types/app";

const setupAsyncLocalStorage = asyncErrorCatcher(
  async (req: Request, res: Response, next: NextFunction) => {
    const storage = {};
    asyncLocalStorage.run(storage, async () => {
      const token = tokenService.getTokenFromRequest(req);
      if (!token) return next();
      const verifiedToken = await tokenService.verifyToken(token);
      if (!verifiedToken) return next();
      const alsStore = asyncLocalStorage.getStore() as alStoreType;
      alsStore.loggedInUserId = verifiedToken.id;
      next();
    });
  },
);

export default setupAsyncLocalStorage;
