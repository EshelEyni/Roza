import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import type { ConnectorDb } from "./connectorDb";
import { ConnectorError } from "./connectorError";

// Dev Board access for the Claude connector. Mirrors the storage rules in
// routers/devBoard/devBoardRouter.ts: ticket _id = sha256([owner, id]),
// attachment _id = sha256([owner, ticketId, lower-case filename]).
// Trash is a flag (deletedAt). Nothing here deletes a document.

export const MAX_ATTACHMENT_BYTES = 600_000; // base64 must fit in the 1 MB request

const textFields = ["project", "title", "status", "priority", "scope", "repository", "markdown"] as const;
type TextField = (typeof textFields)[number];
export type TicketFields = Partial<Record<TextField, string>> & { number?: number | null };

type StoredTicket = Record<TextField, string> & {
  _id: string;
  owner: string;
  id: string;
  number: number | null;
  createdAt?: string;
  updatedAt?: string;
  deletedAt: string | null;
  editedInBoard?: boolean;
};

const digest = (...values: string[]) => createHash("sha256").update(JSON.stringify(values)).digest("hex");
const duplicate = (error: unknown) => (error as { code?: number })?.code === 11000;

function checkFilename(value: string) {
  if (
    !value.trim() ||
    value.length > 255 ||
    /[<>:"/\\|?*\x00-\x1f]|[. ]$|^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value)
  )
    throw new ConnectorError(`"${value}" is not a valid attachment filename.`);
  return value;
}

export function createDevBoardStore(db: ConnectorDb, owner: string) {
  const tickets = () => db.devTickets();
  const attachments = () => db.devAttachments();

  async function findTicket(id: string, mustBeActive: boolean) {
    const ticket = (await tickets().findOne({ _id: digest(owner, id), owner } as never)) as StoredTicket | null;
    if (!ticket) throw new ConnectorError(`No Dev Board ticket with id "${id}". Call devboard_list_tickets.`);
    if (mustBeActive && ticket.deletedAt !== null)
      throw new ConnectorError(`Ticket "${id}" is in Trash. Restore it first with devboard_set_trash.`);
    return ticket;
  }

  async function attachmentNames(ticketId?: string) {
    const files = await attachments()
      .find({ owner, ...(ticketId ? { ticket: ticketId } : {}) }, { projection: { bytes: 0 } })
      .toArray();
    const names = new Map<string, string[]>();
    for (const file of files) names.set(file.ticket, [...(names.get(file.ticket) ?? []), file.filename]);
    for (const list of names.values()) list.sort((a, b) => a.localeCompare(b));
    return names;
  }

  async function listTickets(includeTrash: boolean) {
    const [rows, names] = await Promise.all([
      tickets()
        .find({ owner }, { projection: { markdown: 0 } })
        .sort({ _id: 1 })
        .toArray() as unknown as Promise<StoredTicket[]>,
      attachmentNames(),
    ]);
    // Assign positions across the full board before hiding Trash.
    return rows.map((row, index) => ({
      id: row.id,
      position: index + 1,
      number: row.number,
      project: row.project,
      title: row.title,
      status: row.status,
      priority: row.priority,
      createdAt: row.createdAt ?? null,
      updatedAt: row.updatedAt ?? null,
      inTrash: row.deletedAt !== null,
      attachments: names.get(row.id) ?? [],
    })).filter(ticket => includeTrash || !ticket.inTrash);
  }

  async function getTicket(id: string) {
    const row = await findTicket(id, false);
    const [names, precedingTickets] = await Promise.all([
      attachmentNames(row.id),
      tickets().countDocuments({ owner, _id: { $lt: row._id } } as never),
    ]);
    return {
      id: row.id,
      position: precedingTickets + 1,
      number: row.number,
      project: row.project,
      title: row.title,
      status: row.status,
      priority: row.priority,
      scope: row.scope,
      repository: row.repository,
      createdAt: row.createdAt ?? null,
      updatedAt: row.updatedAt ?? null,
      inTrash: row.deletedAt !== null,
      trashedAt: row.deletedAt,
      attachments: names.get(row.id) ?? [],
      markdown: row.markdown,
    };
  }

  async function createTicket(fields: TicketFields) {
    const data = {
      project: fields.project?.trim() || "",
      title: fields.title?.trim() || "",
      status: fields.status ?? "Open",
      priority: fields.priority ?? "",
      scope: fields.scope ?? "",
      repository: fields.repository ?? "",
      markdown: fields.markdown ?? "",
      number: fields.number ?? null,
    };
    if (!data.project || !data.title || !data.markdown.trim())
      throw new ConnectorError("project, title and markdown are required.");
    const id = randomUUID();
    const now = new Date().toISOString();
    await tickets().insertOne({ _id: digest(owner, id), owner, id, ...data, createdAt: now, updatedAt: now, deletedAt: null } as never);
    return { id, title: data.title };
  }

  async function updateTicket(id: string, fields: TicketFields) {
    await findTicket(id, true);
    const changes: Record<string, unknown> = {};
    for (const field of textFields) if (fields[field] !== undefined) changes[field] = fields[field];
    if (fields.number !== undefined) changes.number = fields.number;
    for (const field of ["project", "title", "markdown"] as const)
      if (changes[field] !== undefined && !String(changes[field]).trim())
        throw new ConnectorError(`${field} cannot be empty.`);
    if (!Object.keys(changes).length) throw new ConnectorError("Nothing to change.");
    const result = await tickets().updateOne(
      { _id: digest(owner, id), owner, deletedAt: null } as never,
      { $set: { ...changes, updatedAt: new Date().toISOString(), editedInBoard: true } },
    );
    if (!result.matchedCount) throw new ConnectorError(`Ticket "${id}" changed while saving. Try again.`);
    return { id, changed: Object.keys(changes) };
  }

  async function setTrash(id: string, trashed: boolean) {
    await findTicket(id, false);
    const now = new Date().toISOString();
    await tickets().updateOne({ _id: digest(owner, id), owner } as never, {
      $set: { deletedAt: trashed ? now : null, updatedAt: now, editedInBoard: true },
    });
    return { id, inTrash: trashed };
  }

  async function addAttachment(id: string, filename: string, bytes: Buffer) {
    const ticket = await findTicket(id, true);
    checkFilename(filename);
    if (bytes.length > MAX_ATTACHMENT_BYTES)
      throw new ConnectorError(`Attachments are limited to ${MAX_ATTACHMENT_BYTES} bytes through Claude.`);
    // Same as the Dev Board: a taken name gets " (2)", " (3)"… Nothing is overwritten.
    const parsed = path.parse(filename);
    for (let copy = 1; copy < 1000; copy++) {
      const suffix = copy === 1 ? "" : ` (${copy})`;
      const candidate = parsed.name.slice(0, 255 - suffix.length - parsed.ext.length) + suffix + parsed.ext;
      try {
        await attachments().insertOne({
          _id: digest(owner, ticket.id, candidate.toLowerCase()),
          owner,
          ticket: ticket.id,
          filename: candidate,
          bytes,
        } as never);
        return { id, filename: candidate, bytes: bytes.length };
      } catch (error) {
        if (!duplicate(error)) throw error;
      }
    }
    throw new ConnectorError("Too many attachments with this name.");
  }

  async function readAttachment(id: string, filename: string) {
    const ticket = await findTicket(id, false);
    const file = await attachments().findOne({
      _id: digest(owner, ticket.id, filename.toLowerCase()),
      owner,
    } as never);
    if (!file) throw new ConnectorError(`Ticket "${id}" has no attachment named "${filename}".`);
    const bytes: Buffer = Buffer.isBuffer(file.bytes) ? file.bytes : Buffer.from(file.bytes.buffer);
    if (bytes.length > MAX_ATTACHMENT_BYTES)
      throw new ConnectorError("This attachment is too large to read through Claude. Open it in ROZA.");
    const text = bytes.toString("utf8");
    const isText = !text.includes("�") && !/[\x00-\x08\x0e-\x1f]/.test(text);
    return isText
      ? { filename: file.filename, encoding: "utf8", content: text }
      : { filename: file.filename, encoding: "base64", content: bytes.toString("base64") };
  }

  return { listTickets, getTicket, createTicket, updateTicket, setTrash, addAttachment, readAttachment };
}
