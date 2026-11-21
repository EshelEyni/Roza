const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");

const maxAttachmentBytes = 12 * 1024 * 1024;
const hash = (value) => createHash("sha256").update(value).digest("hex");

function verifyFilename(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 255 ||
      /[<>:"/\\|?*\x00-\x1f]|[. ]$|^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value)) {
    throw new Error("Invalid attachment filename.");
  }
  return value;
}

async function exists(filename) {
  try { await fs.access(filename); return true; }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
}

async function boundedRead(filename, limit) {
  const info = await fs.lstat(filename);
  if (!info.isFile() || info.size > limit) throw new Error("File is unavailable or exceeds the size limit.");
  const bytes = await fs.readFile(filename);
  if (bytes.length > limit) throw new Error("File exceeds the size limit.");
  return bytes;
}

function registerDevBoard({ app, ipcMain, dialog, clipboard, shell, window, origin, checkAdmin }) {
  const defaultSource = path.resolve(__dirname, "..", "..", "..", "ticket-master", "data");
  const source = process.env.ROZA_DEV_BOARD_IMPORT_DIR;
  let importDir = source && path.isAbsolute(source) ? source : !app.isPackaged ? defaultSource : null;
  let selected = [];
  let knownImports = new Map();
  const cache = path.join(app.getPath("userData"), "dev-board", "attachments");

  function folder(account, id) {
    if (typeof account !== "string" || !account || typeof id !== "string" || !id) {
      throw new Error("Invalid ticket reference.");
    }
    return path.join(cache, hash(account), hash(id));
  }

  const handlers = {
    async readImport() {
      const file = importDir && path.join(importDir, "tickets.json");
      if (!file || !await exists(file)) return null;
      const content = (await boundedRead(file, 5_000_000)).toString("utf8").replace(/^\uFEFF/, "");
      const { tickets } = JSON.parse(content);
      if (!Array.isArray(tickets)) throw new Error("Invalid ticket import file.");
      const root = path.join(importDir, "attachments");
      if (await exists(root) && !(await fs.lstat(root)).isDirectory()) {
        throw new Error("Invalid import attachment directory.");
      }
      const pending = new Map();
      const attachments = [];
      for (const { id } of tickets) {
        if (typeof id !== "string" || !id) throw new Error("Invalid ticket ID in import file.");
        const dir = path.join(root, hash(id));
        if (!await exists(dir)) continue;
        if (!(await fs.lstat(dir)).isDirectory()) throw new Error("Invalid ticket attachment folder.");
        for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
          if (!entry.isFile()) continue;
          const filename = verifyFilename(entry.name);
          const full = path.join(dir, filename);
          pending.set(JSON.stringify([id, filename]), full);
          attachments.push({ id, filename });
        }
      }
      knownImports = pending;
      return { content, attachments };
    },
    async chooseImport() {
      const choice = await dialog.showOpenDialog(window, { title: "Select the folder containing tickets.json", properties: ["openDirectory"] });
      if (choice.canceled) return false;
      const dir = choice.filePaths[0];
      if (!dir || !await exists(path.join(dir, "tickets.json"))) throw new Error("The selected folder must contain tickets.json.");
      importDir = dir;
      knownImports.clear();
      return true;
    },
    async readImportAttachment(id, filename) {
      const full = knownImports.get(JSON.stringify([id, filename]));
      if (!full) throw new Error("Attachment is unavailable in the import folder.");
      return boundedRead(full, maxAttachmentBytes);
    },
    async chooseAttachments() {
      const choice = await dialog.showOpenDialog(window, { title: "Attach files to ticket", properties: ["openFile", "multiSelections"] });
      selected = choice.canceled ? [] : choice.filePaths;
      return selected.map(file => path.basename(file));
    },
    async readChosenAttachment(index) {
      if (!Number.isSafeInteger(index) || !selected[index]) throw new Error("Choose the attachment again.");
      return boundedRead(selected[index], maxAttachmentBytes);
    },
    async cacheAttachment(account, id, filename, bytes) {
      if (!(bytes instanceof Uint8Array) || bytes.byteLength > maxAttachmentBytes) throw new Error("Invalid attachment bytes.");
      const dir = folder(account, id);
      const target = path.join(dir, verifyFilename(filename));
      await fs.mkdir(dir, { recursive: true });
      const temp = path.join(dir, randomUUID() + ".tmp");
      try {
        await fs.writeFile(temp, bytes, { flag: "wx" });
        await fs.rename(temp, target);
      } finally {
        await fs.rm(temp, { force: true });
      }
    },
    async revealAttachment(account, id, filename) {
      const dir = folder(account, id);
      if (filename !== undefined) {
        const file = path.join(dir, verifyFilename(filename));
        if (!(await fs.lstat(file)).isFile()) throw new Error("Attachment is missing.");
        shell.showItemInFolder(file);
      } else {
        const error = await shell.openPath(dir);
        if (error) throw new Error(error);
      }
    },
    copy(text) {
      if (typeof text !== "string") throw new Error("Invalid clipboard text.");
      clipboard.writeText(text);
    },
    paste: () => clipboard.readText(),
  };

  const fromDevBoard = (event) =>
    !window.isDestroyed() && event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame &&
    window.webContents.getURL().split(/[?#]/, 1)[0] === origin + "/dev-board";

  for (const [method, handle] of Object.entries(handlers)) {
    ipcMain.handle("dev-board:" + method, async (event, ...args) => {
      if (!fromDevBoard(event) || !await checkAdmin().catch(() => false) || !fromDevBoard(event)) {
        throw new Error("Dev Board file access denied.");
      }
      return handle(...args);
    });
  }
}

module.exports = { registerDevBoard };
