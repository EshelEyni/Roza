import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ConnectorDb } from "./connectorDb";
import { ConnectorError } from "./connectorError";
import { createDevBoardStore, MAX_ATTACHMENT_BYTES } from "./devBoardStore";
import { createStagingStore, EDITABLE_BOOK_FIELDS } from "./stagingStore";
import { logger } from "../services/logger/loggerService";

// The tools Claude can call. They reach only the Dev Board and Staging Room
// collections. No tool hard-deletes anything, reads or writes the live books,
// or touches users.

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
const richText = z.union([z.string(), z.array(z.any())]);
// Slate nodes exactly as the Writing Studio stores them: [{ type, align?, children: [{ text, bold?, italic?, underline? }] }].
const slate = z.array(z.record(z.any())).describe("Slate nodes, as the Writing Studio stores them.");
const taskBoard = z.object({ lists: z.array(z.any()) }).passthrough();
const planning = z.object({
  characters: z.record(z.string()).optional(),
  themes: z.record(z.string()).optional(),
  plotlines: z.record(z.string()).optional(),
}).describe("Links to story elements by name, each with a note: { characters: { Ann: \"POV\" } }.");
const userIdField = z.string().regex(/^[a-f0-9]{24}$/i).describe("Id of the ROZA user who owns the live book.");
const bookFields = {
  bookName: z.string().min(1).max(300).optional(),
  userId: userIdField.optional(),
  language: z.enum(["he", "en"]).optional(),
  wordGoal: z.number().int().min(1).max(10_000_000).nullable().optional(),
  taskBoard: taskBoard.nullable().optional(),
  publishing: z.record(z.any()).nullable().optional()
    .describe("EPUB settings: title, author, language, includeTitlePage, includeToc, chapterIds (live chapter ids), cover, identifier, readerBookId, publishedAt, sourceUpdatedAt."),
  audiobookNarrator: z.object({ engine: z.string(), voice: z.string(), name: z.string(), lang: z.string().optional() })
    .passthrough().nullable().optional(),
  characters: z.record(richText).nullable().optional(),
  themes: z.record(z.tuple([z.string(), richText])).nullable().optional(),
  plotlines: z.record(z.tuple([z.string(), richText])).nullable().optional(),
  notes: z.record(richText).nullable().optional(),
  replaceText: z.array(z.tuple([z.string(), z.string()])).nullable().optional()
    .describe("Find/replace pairs Push applies to the whole live book."),
  archiveInProd: z.array(z.string()).nullable().optional().describe("Live chapter names Push archives."),
  syncChapterOrder: z.boolean().nullable().optional().describe("true: Push orders the live chapters like the staged numbers."),
};
const chapterFile = z.object({ file: z.string().min(1).max(200), data: z.record(z.any()) });

export function createMcpServer({ db, userId, clientId }: Context): McpServer {
  const server = new McpServer(
    { name: "roza", version: "2.0.0" },
    {
      instructions:
        "ROZA tools for the author's Dev Board (tickets) and Staging Room (staged books). " +
        "Staging Room changes stay staged: the author reviews them and pushes to the live books in ROZA. " +
        "Chapter text is Markdown: # and ## headings, > quotes, - and 1. lists, **bold**, *italic*, <u>underline</u>; each line is its own paragraph. " +
        "To keep every field exactly (alignment, screenplay layout, notes, drafts, planning, task boards), read chapters with view \"full\" and send Slate nodes. " +
        "Replacing or removing a staged chapter keeps a backup, but still confirm with the author first. " +
        "Nothing can be permanently deleted through these tools.",
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
  server.registerTool(
    "staging_list_projects",
    {
      title: "List staged projects",
      description: "Lists Staging Room projects in the author's order, with chapter and word counts, plus list preferences.",
      annotations: read,
    },
    async () => run(() => staging.listProjects()),
  );
  server.registerTool(
    "staging_get_project",
    {
      title: "Read a staged project",
      description:
        "Returns every field of the staged book (owner, characters, themes, plotlines, notes, task board, publishing, narrator, push edits), " +
        "its link to the live book, and its chapter list.",
      inputSchema: { slug },
      annotations: read,
    },
    async args => run(() => staging.getProject(args.slug)),
  );
  server.registerTool(
    "staging_get_chapter",
    {
      title: "Read a staged chapter",
      description:
        'Reads a staged chapter. view "markdown" (default) gives the title, description and text as Markdown, plus notes, drafts and planning. ' +
        'view "full" gives the stored chapter exactly: Slate text and description, planning, notes, drafts, task board and mainSourceDraftId.',
      inputSchema: { slug, number: chapterNumber, view: z.enum(["markdown", "full"]).optional() },
      annotations: read,
    },
    async args => run(() => staging.getChapter(args.slug, args.number, args.view)),
  );
  server.registerTool(
    "staging_create_project",
    {
      title: "Create a staged project",
      description:
        "Creates an empty staged project for a new book. Push it from the Staging Room to create the live book. " +
        "userId defaults to the signed-in author.",
      inputSchema: {
        slug: z.string().min(1).max(200).describe("Short project name, e.g. my-lost-time."),
        bookName: z.string().min(1).max(300),
        language: z.enum(["he", "en"]),
        userId: userIdField.optional(),
      },
      annotations: write,
    },
    async args =>
      runWrite("staging_create_project", args.slug, () => staging.createProject(args.slug, args.bookName, args.language, args.userId)),
  );
  server.registerTool(
    "staging_import_project",
    {
      title: "Import a staged project",
      description:
        "Creates a staged project from a full book (book.json), chapter files and sync state (.publish-state.json), " +
        "like the Staging Room's Import folder. The sync state links it to the live book, so Push updates that book. " +
        "Refuses if the project exists. For large books, import the book and state first, then add chapters with staging_save_chapter and staging_update_chapter.",
      inputSchema: {
        slug: z.string().min(1).max(200).describe("Short project name, e.g. my-lost-time."),
        book: z.record(z.any()).describe("The whole book: bookName, userId, language, characters, themes, plotlines, notes, and any other book field."),
        chapters: z.array(chapterFile).max(2000).optional().describe("Chapter files: { file: \"01.json\", data: { number, name, text, ... } }."),
        state: z.record(z.any()).optional().describe("The sync state: prodBookId, dbName, chapters (file → live chapter id), fingerprints."),
      },
      annotations: write,
    },
    async args => runWrite("staging_import_project", args.slug, () => staging.importProject(args as never)),
  );
  server.registerTool(
    "staging_save_chapter",
    {
      title: "Save a staged chapter",
      description:
        'Saves a staged chapter\'s text, as Markdown or as Slate nodes. mode "create" adds chapter `number` and refuses if it exists. ' +
        'mode "replace" overwrites the text after the author confirms; the old version goes to a backup. ' +
        "Set the chapter's other fields with staging_update_chapter.",
      inputSchema: {
        slug,
        number: chapterNumber,
        title: z.string().max(200).optional().describe("Chapter title. Replace keeps the old title if omitted."),
        text: z.union([markdown.min(1), slate.min(1)]).describe("The full chapter text: Markdown, or Slate nodes to keep alignment and screenplay layout."),
        mode: z.enum(["create", "replace"]),
        file: z.string().min(1).max(200).optional()
          .describe('create only: the chapter file name from the project\'s sync state (e.g. "01.json"), so it stays linked to its live chapter.'),
      },
      annotations: overwrite,
    },
    async args => runWrite("staging_save_chapter", `${args.slug}#${args.number}`, () => staging.saveChapter(args as never)),
  );
  server.registerTool(
    "staging_update_chapter",
    {
      title: "Edit staged chapter fields",
      description:
        "Changes any field of a staged chapter except its text and number: title, description (Markdown or Slate), format, " +
        "planning, annotations (chapter notes), drafts, taskBoard and mainSourceDraftId. Fields left out stay as they are. " +
        "null removes a field from the staged chapter, so Push leaves the live chapter's version alone. The old version goes to a backup.",
      inputSchema: {
        slug,
        number: chapterNumber,
        title: z.string().max(200).optional(),
        description: z.union([markdown, slate]).nullable().optional(),
        format: z.enum(["prose", "screenplay"]).optional(),
        planning: planning.nullable().optional(),
        annotations: z.array(z.record(z.any())).nullable().optional()
          .describe("Chapter notes: { id, general?, content, quote, anchor: { anchor: { path, offset }, focus: { path, offset } } | null }."),
        drafts: z.array(z.record(z.any())).nullable().optional()
          .describe("Drafts: { id, kind?, summary?, chapterId, name, text (Slate), createdAt, updatedAt, annotations?, format? }."),
        taskBoard: taskBoard.nullable().optional(),
        mainSourceDraftId: z.string().max(200).nullable().optional(),
      },
      annotations: overwrite,
    },
    async ({ slug: project, number, ...changes }) =>
      runWrite("staging_update_chapter", `${project}#${number}`, () => staging.updateChapter({ slug: project, number, ...changes } as never)),
  );
  server.registerTool(
    "staging_remove_chapter",
    {
      title: "Remove a staged chapter",
      description: "Removes a chapter from the staged project after the author confirms. It goes to a backup and can be restored. The live book is not changed.",
      inputSchema: { slug, number: chapterNumber },
      annotations: overwrite,
    },
    async args => runWrite("staging_remove_chapter", `${args.slug}#${args.number}`, () => staging.removeChapter(args.slug, args.number)),
  );
  server.registerTool(
    "staging_set_chapter_order",
    {
      title: "Reorder staged chapters",
      description: "Renumbers chapters 1..n. order lists every current chapter number once, in the new order.",
      inputSchema: { slug, order: z.array(chapterNumber).min(1).max(2000) },
      annotations: write,
    },
    async args => runWrite("staging_set_chapter_order", args.slug, () => staging.setChapterOrder(args.slug, args.order)),
  );
  server.registerTool(
    "staging_update_book",
    {
      title: "Edit staged book details",
      description:
        `Replaces the given book fields (${EDITABLE_BOOK_FIELDS.join(", ")}). Fields left out stay as they are. ` +
        "characters and notes map name → text; themes and plotlines map name → [\"#rrggbb\", text]. " +
        "Text is a plain string (lines become paragraphs) or Slate nodes. Send the whole map for any field you change. " +
        "null on wordGoal, publishing or audiobookNarrator tells Push to remove it from the live book; null on other fields removes them from the staged book. " +
        "The old book goes to a backup.",
      inputSchema: { slug, ...bookFields },
      annotations: overwrite,
    },
    async ({ slug: project, ...changes }) =>
      runWrite("staging_update_book", project, () => staging.updateBook(project, changes as never)),
  );
  server.registerTool(
    "staging_set_preferences",
    {
      title: "Set Staging Room list preferences",
      description: "Sets the project list order, hidden projects, and whether hidden ones show. Fields left out stay as they are.",
      inputSchema: {
        order: z.array(z.string().max(200)).max(1000).optional(),
        hidden: z.array(z.string().max(200)).max(1000).optional(),
        showHidden: z.boolean().optional(),
      },
      annotations: write,
    },
    async args => runWrite("staging_set_preferences", "preferences", () => staging.setPreferences(args)),
  );
  server.registerTool(
    "staging_list_backups",
    {
      title: "List staged project backups",
      description: "Lists the latest 50 backups of a staged project. Backups made by Claude can be restored.",
      inputSchema: { slug },
      annotations: read,
    },
    async args => run(() => staging.listBackups(args.slug).then(backups => ({ backups }))),
  );
  server.registerTool(
    "staging_restore_backup",
    {
      title: "Restore a staged backup",
      description: "Restores a chapter or book details from a backup made by Claude. The current version is backed up first.",
      inputSchema: { slug, backupId: z.string().length(24) },
      annotations: overwrite,
    },
    async args => runWrite("staging_restore_backup", `${args.slug}/${args.backupId}`, () => staging.restoreBackup(args.slug, args.backupId)),
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
