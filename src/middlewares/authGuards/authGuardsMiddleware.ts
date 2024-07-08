import { Request, Response, NextFunction } from "express";

import mongoose from "mongoose";
import { AppError, asyncErrorCatcher } from "../../services/error/errorService";
import tokenService from "../../services/token/tokenService";
import { isValidMongoId } from "../../services/util/utilService";
import { getLoggedInUserIdFromReq } from "../../services/ALSService";

const checkUserAuthentication = asyncErrorCatcher(
  async (req: Request, res: Response, next: NextFunction) => {
    const token = tokenService.getTokenFromRequest(req);
    if (!token)
      return next(
        new AppError("You are not logged in! Please log in to get access.", 401)
      );
    const verifiedToken = await tokenService.verifyToken(token);
    if (!verifiedToken) return next(new AppError("Invalid Token", 401));
    const { id, timeStamp } = verifiedToken;

    if (!isValidMongoId(id)) return next(new AppError("Invalid User Id", 401));
    const db = mongoose.connection;
    const userCollection = db.collection("users");

    const user = await userCollection.findOne({
      _id: new mongoose.Types.ObjectId(id),
    });

    if (!user)
      return next(
        new AppError("The user belonging to this token does not exist.", 401)
      );
    const changedPasswordAfter = user.changedPasswordAfter(timeStamp);
    if (changedPasswordAfter)
      return next(
        new AppError(
          "User recently changed password! Please log in again.",
          401
        )
      );
    next();
  }
);

const checkAdminAuthorization = asyncErrorCatcher(
  async (req: Request, res: Response, next: NextFunction) => {
    const loggedInUserId = getLoggedInUserIdFromReq();
    if (!loggedInUserId) throw new AppError("User not logged in", 401);
    const db = mongoose.connection;
    const userCollection = db.collection("users");
    const user = await userCollection.findOne({
      _id: new mongoose.Types.ObjectId(loggedInUserId),
    });
    if (!user) throw new AppError("User not found", 404);
    if (!user.roles.includes("admin"))
      throw new AppError(
        "You do not have permission to perform this action",
        403
      );
    next();
  }
);

export { checkUserAuthentication, checkAdminAuthorization };
