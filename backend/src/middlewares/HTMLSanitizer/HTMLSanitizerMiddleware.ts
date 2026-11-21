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
  // AI manuscript input is plain text rendered by React/Slate, never HTML.
  // Sanitizing it would silently change the author's source before editing.
  if (req.method === "POST" && /^\/api\/book\/[a-f0-9]{24}\/chapters\/[a-f0-9]{24}\/ai-edit\/?$/i.test(req.path)) {
    return next();
  }
  // Reader documents are rich text rendered by Slate as text nodes, never as
  // HTML, and are rebuilt from an allow-list by readerDocumentContent. HTML
  // escaping would corrupt characters such as "&" and "<" on every autosave.
  if (
    (req.method === "POST" || req.method === "PATCH") &&
    /^\/api\/reader\/[a-f0-9]{24}\/documents(?:\/[a-f0-9]{24})?\/?$/i.test(req.path)
  ) {
    return next();
  }
  // The EPUB builder XML-escapes every field itself. HTML escaping here would
  // turn "&" in a title into "&amp;" and break the cover data URL check.
  if (
    (req.method === "POST" || req.method === "PUT") &&
    /^\/api\/reader\/studio\/[a-f0-9]{24}\/(?:epub|publication)\/?$/i.test(req.path)
  )
    return next();
  // Dev Board validates its own fields and renders Markdown without raw HTML.
  if (/^\/api\/dev-board(?:\/|$)/.test(req.path)) return next();
  const { body } = req;
  const { params } = req;
  const { query } = req;
  if (body) _sanitizeBody(body);
  if (params) _sanitizeParams(params);
  if (query) _sanitizeQuery(query);
  next();
}

export default requestSanitizer;
