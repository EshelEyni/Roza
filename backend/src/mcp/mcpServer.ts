import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ConnectorDb } from "./connectorDb";
import { ConnectorError } from "./connectorError";
import { createDevBoardStore, MAX_ATTACHMENT_BYTES } from "./devBoardStore";
import { createStagingStore } from "./stagingStore";
import { MAX_EDITS } from "./textEdits";
import { logger } from "../services/logger/loggerService";

// The tools Claude can call. They reach only the Dev Board and Staging Room
// collections. No tool hard-deletes anything, writes the live books, or touches
// users. Staging tools read the copy of the live book kept on each staging row.

export const MAX_TEXT_CHARS = 900_000; // stays under the 1 MB request limit
const WRITE_LIMIT = 60;
const WRITE_WINDOW = 15 * 60 * 1000;
const recentWrites = new Map<string, number[]>();

type Context = { db: ConnectorDb; userId: string; clientId: string };
type Result = { content: { type: "text"; text: string }[]; isError?: boolean };

const ticketId = z.string().min(1).max(200).describe("Ticket id from devboard_list_tickets.");
const slug = z.string().min(1).max(200).describe("Staged project name (slug) from staging_list_projects.");
const chapterNumber = z.number().int().min(0).max(100_000).describe("Chapter number as shown by staging_get_project.");
const markdown = z.string().max(MAX_TEXT_CHARS);
const ticketFields = {
  project: z.string().max(200).optional(),
  title: z.string().max(500).optional(),
  status: z.string().max(100).optional().describe('For example "Open", "In progress", "Done".'),
  priority: z.string().max(100).optional(),
  scope: z.string().max(1000).optional(),
  repository: z.string().max(1000).optional(),
  number: z.number().int().nullable().optional().describe("Ticket number, or null."),
  markdown: markdown.optional().describe("The full ticket body in Markdown."),
};
// Slate nodes exactly as the Writing Studio stores them: [{ type, align?, children: [{ text, bold?, italic?, underline? }] }].
const slate = z.array(z.record(z.any())).describe("Slate nodes, as the Writing Studio stores them.");
const notes = z
  .array(z.object({ content: z.string().min(1).max(50_000), quote: z.string().max(2000).optional().describe("Exact text the note points at.") }))
  .max(200);

export function createMcpServer({ db, userId, clientId }: Context): McpServer {
  const server = new McpServer(
    { name: "roza", version: "2.0.0" },
    {
      instructions:
        "ROZA tools for the author's Dev Board (tickets) and Staging Room (staged books). " +
        "Staging Room is a safe place for book edits: you add pending changes, and nothing reaches the author's live book in Writing Studio until they approve it. " +
        "Edit chapter text with staging_write_draft (a new draft based on the current Main). Use staging_edit_main only when the author asks to edit Main. " +
        "For small changes, don't resend the chapter: start a draft with staging_copy_draft, then use staging_edit_text (find/replace). " +
        "Read only what you need with staging_get_chapter's version, paragraphs and search options. " +
        "Save after each step while working with the author: saving again updates the same pending draft, and the author sees it live. " +
        "Chapter text is Markdown: # and ## headings, > quotes, - and 1. lists, **bold**, *italic*, <u>underline</u>; each line is its own paragraph. " +
        "For screenplays, read chapters with view \"full\" and send Slate nodes. " +
        "Nothing can be deleted through these tools.",
    },
  );
  const devBoard = createDevBoardStore(db, userId);
  const staging = createStagingStore(db, userId, clientId);
  const read = { readOnlyHint: true, openWorldHint: false };
  const write = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
  const overwrite = { readOnlyHint: false, destructiveHint: true, openWorldHint: false };

  // ---- Dev Board -------------------------------------------------------------
  server.registerTool(
    "devboard_list_tickets",
    {
      title: "List Dev Board tickets",
      description: "Lists tickets: id, number, project, title, status, priority, attachments. Trash is hidden unless includeTrash is true.",
      inputSchema: { includeTrash: z.boolean().optional() },
      annotations: read,
    },
    async args => run(() => devBoard.listTickets(!!args.includeTrash).then(tickets => ({ tickets }))),
  );
  server.registerTool(
    "devboard_get_ticket",
    { title: "Read a ticket", description: "Returns a ticket's fields and full Markdown.", inputSchema: { id: ticketId }, annotations: read },
    async args => run(() => devBoard.getTicket(args.id)),
  );
  server.registerTool(
    "devboard_create_ticket",
    {
      title: "Create a ticket",
      description: "Creates a Dev Board ticket. project, title and markdown are required. status defaults to Open.",
      inputSchema: ticketFields,
      annotations: write,
    },
    async args => runWrite("devboard_create_ticket", args.title || "", () => devBoard.createTicket(args)),
  );
  server.registerTool(
    "devboard_update_ticket",
    {
      title: "Edit a ticket",
      description: "Changes the given fields of a ticket. Fields left out stay as they are. Tickets in Trash must be restored first.",
      inputSchema: { id: ticketId, ...ticketFields },
      annotations: overwrite,
    },
    async ({ id, ...fields }) => runWrite("devboard_update_ticket", id, () => devBoard.updateTicket(id, fields)),
  );
  server.registerTool(
    "devboard_set_trash",
    {
      title: "Move a ticket to or from Trash",
      description: "trashed true moves the ticket to Trash; false restores it. Trash keeps the ticket. There is no permanent delete.",
      inputSchema: { id: ticketId, trashed: z.boolean() },
      annotations: write,
    },
    async args => runWrite("devboard_set_trash", args.id, () => devBoard.setTrash(args.id, args.trashed)),
  );
  server.registerTool(
    "devboard_add_attachment",
    {
      title: "Attach a file to a ticket",
      description:
        `Adds a file to a ticket. Give text, or base64 for binary files (max ${MAX_ATTACHMENT_BYTES} bytes). ` +
        'If the name is taken, the file is saved as "name (2).ext". Existing files are never overwritten.',
      inputSchema: {
        id: ticketId,
        filename: z.string().min(1).max(255),
        text: z.string().max(MAX_ATTACHMENT_BYTES).optional(),
        base64: z.string().max(Math.ceil(MAX_ATTACHMENT_BYTES / 3) * 4).optional(),
      },
      annotations: write,
    },
    async args =>
      runWrite("devboard_add_attachment", `${args.id}/${args.filename}`, () => {
        if ((args.text === undefined) === (args.base64 === undefined))
          throw new ConnectorError("Give exactly one of text or base64.");
        const bytes = args.text !== undefined ? Buffer.from(args.text, "utf8") : Buffer.from(args.base64!, "base64");
        return devBoard.addAttachment(args.id, args.filename, bytes);
      }),
  );
  server.registerTool(
    "devboard_read_attachment",
    {
      title: "Read a ticket attachment",
      description: "Returns an attachment as text, or as base64 when it is binary.",
      inputSchema: { id: ticketId, filename: z.string().min(1).max(255) },
      annotations: read,
    },
    async args => run(() => devBoard.readAttachment(args.id, args.filename)),
  );

  // ---- Staging Room ----------------------------------------------------------
  // Claude only adds pending changes. The author approves each one in the Staging Room.
  server.registerTool(
    "staging_list_projects",
    {
      title: "List staged books",
      description: "Lists the author's Staging Room books with chapter counts and how many changes wait for approval.",
      annotations: read,
    },
    async () => run(() => staging.listProjects()),
  );
  server.registerTool(
    "staging_get_project",
    {
      title: "Read a staged book",
      description:
        "Returns the live book's outline (chapters numbered 1..n with titles, word counts and draft names; characters, themes, plotlines, notes) " +
        "and the changes waiting for the author's approval.",
      inputSchema: { slug },
      annotations: read,
    },
    async args => run(() => staging.getProject(args.slug)),
  );
  server.registerTool(
    "staging_get_chapter",
    {
      title: "Read a chapter",
      description:
        'Reads a chapter\'s current Main text from Writing Studio, plus the pending drafts and Main edit for it. view "markdown" (default) or "full" (Slate nodes, keeps alignment and screenplay layout). ' +
        'Keep reads small: version reads one text only ("main", or a pending draft name or changeId) with its notes. ' +
        'paragraphs {from, to} (0-based, inclusive) or search return only those paragraphs, each with its index. ' +
        'Without version, pending texts are included for view "markdown" and left out for view "full" (set includeDrafts to change that).',
      inputSchema: {
        slug,
        number: chapterNumber,
        view: z.enum(["markdown", "full"]).optional(),
        version: z.string().min(1).max(200).optional().describe('"main", or a pending draft name or changeId.'),
        includeDrafts: z.boolean().optional(),
        paragraphs: z
          .object({ from: z.number().int().min(0).optional(), to: z.number().int().min(0).optional() })
          .optional()
          .describe("0-based paragraph range, inclusive."),
        search: z.string().min(1).max(2000).optional().describe("Returns only paragraphs that contain this text (case-insensitive)."),
      },
      annotations: read,
    },
    async ({ slug: project, number, view, ...options }) => run(() => staging.getChapter(project, number, view, options)),
  );
  server.registerTool(
    "staging_create_project",
    {
      title: "Start a new book",
      description:
        "Starts a staged book that is not in Writing Studio yet. Add chapters with staging_add_chapter. " +
        "The book is created in Writing Studio when the author approves its first change. To stage an existing book, ask the author to use Stage a book in the Staging Room.",
      inputSchema: {
        slug: z.string().min(1).max(200).describe("Short project name, e.g. my-lost-time."),
        bookName: z.string().min(1).max(300),
        language: z.enum(["he", "en"]),
      },
      annotations: write,
    },
    async args => runWrite("staging_create_project", args.slug, () => staging.createProject(args.slug, args.bookName, args.language)),
  );
  server.registerTool(
    "staging_write_draft",
    {
      title: "Write a draft of a chapter",
      description:
        "The default way to edit chapter text. Saves the full new text as a pending draft of the chapter, based on its current Main. " +
        "Calling it again for the same chapter updates the same pending draft (so you can save after each step while working with the author). " +
        "Pass name to update the pending draft with that name. Set newDraft only when the author asks for a separate draft. " +
        "On approval it becomes a normal draft in Writing Studio; Main is not touched. " +
        "To change a few sentences, use staging_edit_text instead of resending the whole chapter. " +
        "notes are added to the draft's notes. Notes are never removed: they follow their sentence, or become general notes when it is gone.",
      inputSchema: {
        slug,
        number: chapterNumber,
        text: z.union([markdown.min(1), slate.min(1)]).describe("The full draft text: Markdown, or Slate nodes."),
        name: z.string().max(200).optional().describe('Draft name. Default "Claude · <date>".'),
        newDraft: z.boolean().optional(),
        notes: notes.optional(),
      },
      annotations: write,
    },
    async ({ slug: project, ...rest }) =>
      runWrite("staging_write_draft", `${project}#${rest.number}`, () => staging.writeDraft({ slug: project, ...rest } as never)),
  );
  server.registerTool(
    "staging_edit_main",
    {
      title: "Edit a chapter's Main text",
      description:
        "Only when the author explicitly asks to edit Main (otherwise use staging_write_draft). Saves the full new Main text as a pending change. " +
        "If the author changes Main in Writing Studio before approving, it is added as a draft instead, so nothing is overwritten.",
      inputSchema: {
        slug,
        number: chapterNumber,
        text: z.union([markdown.min(1), slate.min(1)]),
        notes: notes.optional(),
      },
      annotations: write,
    },
    async ({ slug: project, ...rest }) =>
      runWrite("staging_edit_main", `${project}#${rest.number}`, () => staging.editMain({ slug: project, ...rest } as never)),
  );
  server.registerTool(
    "staging_edit_text",
    {
      title: "Make small text edits",
      description:
        "The fastest way to change a few sentences. Find/replace on one text of a chapter, applied by ROZA; you never resend the chapter. " +
        'target: a pending draft name or changeId; "main" edits the pending Main edit (or starts one; only when the author asks to edit Main); ' +
        "left out, the chapter's only pending draft. " +
        "find is matched against the Markdown that staging_get_chapter shows (**bold**, *italic*, escaped \\*), with paragraphs joined by a blank line. " +
        "Each find must match exactly once, or nothing is saved. A replace with a blank line makes new paragraphs; an empty replace deletes the text, and an emptied paragraph. " +
        "Untouched paragraphs keep their exact layout. Notes follow their sentence; a note whose sentence is gone becomes a general note and is reported. " +
        "dryRun shows each edit before and after, without saving.",
      inputSchema: {
        slug,
        number: chapterNumber,
        target: z.string().min(1).max(200).optional(),
        edits: z
          .array(z.object({ find: z.string().min(1).max(20_000), replace: z.string().max(100_000) }))
          .min(1)
          .max(MAX_EDITS)
          .describe("Applied in order. Each find sees the text after the edits before it."),
        dryRun: z.boolean().optional(),
      },
      annotations: write,
    },
    async ({ slug: project, ...rest }) =>
      rest.dryRun
        ? run(() => staging.editText({ slug: project, ...rest }))
        : runWrite("staging_edit_text", `${project}#${rest.number}`, () => staging.editText({ slug: project, ...rest })),
  );
  server.registerTool(
    "staging_copy_draft",
    {
      title: "Copy a text into a new draft",
      description:
        'Starts a new pending draft of a chapter as a copy of its Main ("main") or of a pending draft (name or changeId). No text is sent. ' +
        "withNotes also copies the notes. Then change it with staging_edit_text. Drafts already in Writing Studio can't be copied here.",
      inputSchema: {
        slug,
        number: chapterNumber,
        from: z.string().min(1).max(200).describe('"main", or a pending draft name or changeId.'),
        name: z.string().min(1).max(200).describe("Name of the new draft."),
        withNotes: z.boolean().optional(),
      },
      annotations: write,
    },
    async ({ slug: project, ...rest }) =>
      runWrite("staging_copy_draft", `${project}#${rest.number}`, () => staging.copyDraft({ slug: project, ...rest })),
  );
  server.registerTool(
    "staging_add_chapter",
    {
      title: "Add a new chapter",
      description:
        "Adds a pending new chapter. after: the chapter number it follows (0 or omitted = at the end). " +
        "To keep editing a pending new chapter, pass its changeId (from staging_get_project).",
      inputSchema: {
        slug,
        title: z.string().min(1).max(200),
        text: z.union([markdown.min(1), slate.min(1)]),
        after: chapterNumber.optional(),
        changeId: z.string().max(100).optional(),
        notes: notes.optional(),
      },
      annotations: write,
    },
    async ({ slug: project, ...rest }) =>
      runWrite("staging_add_chapter", project, () => staging.addChapter({ slug: project, ...rest } as never)),
  );
  server.registerTool(
    "staging_set_element",
    {
      title: "Add or change a story element",
      description:
        "Adds a new character, theme, plotline or note, or changes the text of an existing one (matched by name). " +
        "Text is Markdown or Slate nodes. Themes and plotlines take a colour (#rrggbb).",
      inputSchema: {
        slug,
        kind: z.enum(["characters", "themes", "plotlines", "notes"]),
        name: z.string().min(1).max(300),
        text: z.union([markdown, slate]),
        color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
      },
      annotations: write,
    },
    async ({ slug: project, ...rest }) =>
      runWrite("staging_set_element", `${project}/${rest.kind}/${rest.name}`, () => staging.setElement({ slug: project, ...rest } as never)),
  );
  server.registerTool(
    "staging_add_notes",
    {
      title: "Add notes to a chapter",
      description: "Adds notes to a chapter's Main text. Each note has content and, optionally, the exact quote it points at. For notes on your draft, pass them to staging_write_draft.",
      inputSchema: { slug, number: chapterNumber, notes: notes.min(1) },
      annotations: write,
    },
    async args => runWrite("staging_add_notes", `${args.slug}#${args.number}`, () => staging.addNotes(args as never)),
  );
  server.registerTool(
    "staging_add_tasks",
    {
      title: "Add tasks to the book board",
      description: "Adds tasks to the book's task board (first list). A task can link to a chapter by number.",
      inputSchema: {
        slug,
        tasks: z
          .array(z.object({ title: z.string().min(1).max(300), description: z.string().max(10_000).optional(), chapter: chapterNumber.optional() }))
          .min(1)
          .max(100),
      },
      annotations: write,
    },
    async args => runWrite("staging_add_tasks", args.slug, () => staging.addTasks(args as never)),
  );

  // ---- helpers ---------------------------------------------------------------
  async function runWrite(tool: string, target: string, action: () => Promise<unknown> | unknown): Promise<Result> {
    const audit = { userId, clientId, tool, target: target.slice(0, 300) };
    if (!takeWriteSlot(userId)) {
      await writeAudit({ ...audit, outcome: "refused", message: "rate limited" });
      return errorResult(`Too many changes. The limit is ${WRITE_LIMIT} per 15 minutes. Try again later.`);
    }
    try {
      const data = await action();
      await writeAudit({ ...audit, outcome: "ok" });
      return okResult(data);
    } catch (error) {
      const refused = error instanceof ConnectorError;
      await writeAudit({ ...audit, outcome: refused ? "refused" : "error", message: (error as Error).message?.slice(0, 500) });
      if (refused) return errorResult(error.message);
      logger.error(`Claude connector ${tool} failed:`, error as Error);
      return errorResult("ROZA could not save the change. Nothing was changed. Try again later.");
    }
  }

  async function writeAudit(entry: { userId: string; clientId: string; tool: string; target: string; outcome: "ok" | "refused" | "error"; message?: string }) {
    logger.info("Claude connector write:", JSON.stringify(entry));
    try {
      await db.Audit.create({ ...entry, at: new Date() });
    } catch (error) {
      logger.error("Claude connector audit log failed:", error as Error);
    }
  }

  return server;
}

async function run(action: () => Promise<unknown>): Promise<Result> {
  try {
    return okResult(await action());
  } catch (error) {
    if (error instanceof ConnectorError) return errorResult(error.message);
    logger.error("Claude connector read failed:", error as Error);
    return errorResult("ROZA could not complete the request. Try again later.");
  }
}

function okResult(data: unknown): Result {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function errorResult(message: string): Result {
  return { content: [{ type: "text", text: message }], isError: true };
}

function takeWriteSlot(userId: string) {
  const now = Date.now();
  const recent = (recentWrites.get(userId) || []).filter(time => now - time < WRITE_WINDOW);
  const allowed = recent.length < WRITE_LIMIT;
  if (allowed) recent.push(now);
  recentWrites.set(userId, recent);
  return allowed;
}

export function resetWriteLimits() {
  recentWrites.clear();
}
