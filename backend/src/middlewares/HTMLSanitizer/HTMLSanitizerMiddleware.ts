import sanitizeHtml from "sanitize-html";
import { Request, Response, NextFunction } from "express";

function _sanitizeBody(body: Record<string, unknown>) {
  for (const key in body) {
    const isValueString = typeof body[key] === "string";
    const isValueObject = typeof body[key] === "object";
    if (!isValueString && !isValueObject) continue;
    if (isValueString) body[key] = sanitizeHtml(body[key] as string);
    if (isValueObject) _sanitizeBody(body[key] as Record<string, unknown>);
  }
}

function _sanitizeParams(params: Record<string, unknown>) {
  for (const key in params) {
    if (typeof params[key] !== "string") continue;
    params[key] = sanitizeHtml(params[key] as string);
  }
}

function _sanitizeQuery(query: Record<string, unknown>) {
  for (const key in query) {
    if (typeof query[key] !== "string") continue;
    query[key] = sanitizeHtml(query[key] as string);
  }
}

function requestSanitizer(req: Request, res: Response, next: NextFunction) {
  const { body } = req;
  const { params } = req;
  const { query } = req;
  if (body) _sanitizeBody(body);
  if (params) _sanitizeParams(params);
  if (query) _sanitizeQuery(query);
  next();
}

export default requestSanitizer;
