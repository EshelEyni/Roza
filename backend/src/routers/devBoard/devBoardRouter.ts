import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import express, { Request } from "express";
import mongoose from "mongoose";
import type { DevTicket } from "../../../../shared/types/devBoard";
import { checkUserAuthentication } from "../../middlewares/authGuards/authGuardsMiddleware";
import { requireFeature } from "../../middlewares/authGuards/featureAccessMiddleware";
import { getLoggedInUserIdFromReq } from "../../services/ALSService";
import { AppError, asyncErrorCatcher } from "../../services/error/errorService";

const router = express.Router();
const textFields = ["project", "title", "status", "priority", "scope", "repository", "markdown"] as const;
type Content = Pick<DevTicket, (typeof textFields)[number] | "number">;
type StoredTicket = Content & {
  _id: string;
  owner: string;
  id: string;
  deletedAt: string | null;
  importHash?: string;
  editedInBoard?: boolean;
};
type StoredAttachment = {
  _id: string;
  owner: string;
  ticket: string;
  filename: string;
  bytes: Buffer;
};

const tickets = () => mongoose.connection.db!.collection<StoredTicket>("dev_board_tickets");
const attachments = () => mongoose.connection.db!.collection<StoredAttachment>("dev_board_attachments", { promoteBuffers: true });
const digest = (...values: string[]) => createHash("sha256").update(JSON.stringify(values)).digest("hex");
const duplicate = (error: unknown) => (error as { code?: number })?.code === 11000;

function owner() {
  const id = getLoggedInUserIdFromReq();
  if (!id) throw new AppError("Sign in to open Dev Board.", 401);
  return id;
}

function ticketId(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value === "." || value === ".." || value.length > 200 || /[/\\\x00-\x1f]/.test(value)) {
    throw new AppError("Invalid ticket ID.", 400);
  }
  return value;
}

function content(input: Record<string, unknown>): Content {
  if (!input || !textFields.every(field => typeof input[field] === "string") ||
      !(input.number === null || Number.isSafeInteger(input.number))) {
    throw new AppError("Invalid ticket fields.", 400);
  }
  return {
    project: input.project as string,
    title: input.title as string,
    status: input.status as string,
    priority: input.priority as string,
    scope: input.scope as string,
    repository: input.repository as string,
    markdown: input.markdown as string,
    number: input.number as number | null,
  };
}

function filename(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 255 ||
      /[<>:"/\\|?*\x00-\x1f]|[. ]$|^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value)) {
    throw new AppError("Invalid attachment filename.", 400);
  }
  return value;
}

async function list(account: string): Promise<DevTicket[]> {
  const [rows, files] = await Promise.all([
    tickets().find({ owner: account }).sort({ _id: 1 }).toArray(),
    attachments().find({ owner: account }, { projection: { bytes: 0 } }).toArray(),
  ]);
  const names = new Map<string, string[]>();
  for (const file of files) {
    const values = names.get(file.ticket) ?? [];
    values.push(file.filename);
    names.set(file.ticket, values);
  }
  return rows.map(({ id, deletedAt, ...row }) => ({
    ...content(row),
    id,
    deletedAt,
    attachments: (names.get(id) ?? []).sort((a, b) => a.localeCompare(b)),
  }));
}

async function requireTicket(req: Request, account: string, active = false) {
  const id = ticketId(req.params.id);
  const ticket = await tickets().findOne({ _id: digest(account, id), owner: account });
  if (!ticket || (active && ticket.deletedAt !== null)) throw new AppError("Ticket is unavailable.", 404);
  return ticket;
}

router.use(checkUserAuthentication, requireFeature("devBoard"), (_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});
router.get("/access", (_req, res) => { res.sendStatus(204); });
router.get("/", asyncErrorCatcher(async (_req, res) => { res.json(await list(owner())); }));

router.post("/", asyncErrorCatcher(async (req, res) => {
  const account = owner();
  const data = content(req.body);
  if (!data.title.trim() || !data.project.trim() || !data.markdown.trim()) {
    throw new AppError("Project, title, and Markdown are required.", 400);
  }
  if (req.body.id !== undefined) {
    const id = ticketId(req.body.id);
    const result = await tickets().updateOne(
      { _id: digest(account, id), owner: account, deletedAt: null },
      { $set: { ...data, editedInBoard: true } },
    );
    if (!result.matchedCount) throw new AppError("Ticket is unavailable.", 404);
  } else {
    const id = randomUUID();
    await tickets().insertOne({ _id: digest(account, id), owner: account, id, ...data, deletedAt: null });
  }
  res.json(await list(account));
}));

router.post("/import", asyncErrorCatcher(async (req, res) => {
  const account = owner();
  if (req.body?.version !== 1 || !Array.isArray(req.body.tickets)) {
    throw new AppError("Expected a version 1 ticket file.", 400);
  }
  const incoming: StoredTicket[] = req.body.tickets.map((entry: Record<string, unknown>) => {
    const data = content(entry);
    const id = ticketId(entry.id);
    const deletedAt = entry.deletedAt;
    if (!(deletedAt === null || typeof deletedAt === "string")) {
      throw new AppError("Invalid Trash state.", 400);
    }
    return {
      _id: digest(account, id), owner: account, id, ...data, deletedAt,
      importHash: digest(JSON.stringify(data), JSON.stringify(deletedAt)),
    };
  });
  if (new Set(incoming.map(ticket => ticket.id)).size !== incoming.length) {
    throw new AppError("Duplicate IDs in the ticket file.", 400);
  }

  const conflicts: string[] = [];
  for (const row of incoming) {
    try {
      await tickets().insertOne(row);
    } catch (error) {
      if (!duplicate(error)) throw error;
      const existing = await tickets().findOne({ _id: row._id, owner: account });
      if (existing?.importHash === row.importHash) continue;
      if (existing?.importHash && !existing.editedInBoard) {
        const result = await tickets().updateOne(
          { _id: row._id, owner: account, importHash: existing.importHash, editedInBoard: { $ne: true } },
          { $set: { ...content(row), deletedAt: row.deletedAt, importHash: row.importHash } },
        );
        if (result.matchedCount) continue;
      }
      conflicts.push(row.id);
    }
  }
  res.json({ conflicts });
}));

router.patch("/:id/trash", asyncErrorCatcher(async (req, res) => {
  const account = owner();
  const ticket = await requireTicket(req, account);
  if (typeof req.body?.deleted !== "boolean") throw new AppError("Invalid Trash state.", 400);
  await tickets().updateOne({ _id: ticket._id }, {
    $set: { deletedAt: req.body.deleted ? new Date().toISOString() : null, editedInBoard: true },
  });
  res.json(await list(account));
}));

router.post("/:id/attachments", express.raw({ type: "application/octet-stream", limit: "12mb" }),
  asyncErrorCatcher(async (req, res) => {
    const account = owner();
    const importing = req.query.import === "1";
    const ticket = await requireTicket(req, account, !importing);
    const name = filename(req.query.filename);
    if (!Buffer.isBuffer(req.body)) throw new AppError("Expected attachment bytes.", 400);
    const bytes: Buffer = req.body;
    const parsed = path.parse(name);
    for (let copy = 1; ; copy++) {
      const suffix = copy === 1 ? "" : " (" + copy + ")";
      const candidate = parsed.name.slice(0, 255 - suffix.length - parsed.ext.length) + suffix + parsed.ext;
      const _id = digest(account, ticket.id, candidate.toLowerCase());
      try {
        await attachments().insertOne({ _id, owner: account, ticket: ticket.id, filename: candidate, bytes });
        break;
      } catch (error) {
        if (!duplicate(error)) throw error;
        if (importing) {
          const existing = await attachments().findOne({ _id });
          if (!existing || existing.filename !== name || !bytes.equals(existing.bytes)) {
            throw new AppError("An attachment already uses this filename.", 409);
          }
          break;
        }
      }
    }
    res.sendStatus(204);
  }),
);

router.get("/:id/attachments", asyncErrorCatcher(async (req, res) => {
  const account = owner();
  const ticket = await requireTicket(req, account);
  const name = filename(req.query.filename);
  const file = await attachments().findOne({ _id: digest(account, ticket.id, name.toLowerCase()), owner: account });
  if (!file) throw new AppError("Attachment is missing.", 404);
  res.set("Cache-Control", "private, no-store").type("application/octet-stream").attachment("attachment");
  res.type("application/octet-stream").send(file.bytes);
}));

export default router;
