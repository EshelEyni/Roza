import type { RequestHandler } from "express";
import { canAccessFeature, type Feature } from "../../config/featureAccess";
import { AppError } from "../../services/error/errorService";

export function requireFeature(feature: Feature): RequestHandler {
  return (_req, res, next) => {
    if (!canAccessFeature(feature, res.locals.authenticatedRoles)) {
      return next(new AppError("You do not have permission to perform this action", 403));
    }
    next();
  };
}
