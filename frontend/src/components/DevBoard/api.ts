import type { DevTicket, DevTicketDraft } from "../../../../shared/types/devBoard";

export const desktopFiles = window.rozaDesktop?.devBoard;
const endpoint = "/api/dev-board";

async function request(path = "", options: RequestInit = {}) {
  const response = await fetch(endpoint + path, { ...options, credentials: "same-origin", cache: "no-store" });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message || data?.data?.message || `Dev Board request failed (${response.status}).`);
  }
  return response;
}

function json(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

const attachmentUrl = (id: string, filename: string) =>
  `/${encodeURIComponent(id)}/attachments?${new URLSearchParams({ filename })}`;

function upload(id: string, filename: string, bytes: Uint8Array, importing = false) {
  return request(attachmentUrl(id, filename) + (importing ? "&import=1" : ""), {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: new Uint8Array(bytes),
  });
}

async function read(): Promise<DevTicket[]> {
  return (await request()).json();
}

export function createDevBoardApi(account: string) {
  let importedSnapshot = "";
  let importing = false;
  let retryAfter = 0;

  async function importChanges() {
    if (!desktopFiles || importing || Date.now() < retryAfter) return null;
    importing = true;
    try {
      const source = await desktopFiles.readImport();
      if (!source) return null;
      const snapshot = source.content + JSON.stringify(source.attachments);
      if (snapshot === importedSnapshot) return null;

      const result: { conflicts: string[]; skipped?: string[] } = await (await request("/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: source.content,
      })).json();
      const failed: string[] = [];
      for (const { id, filename } of source.attachments) {
        if (result.conflicts.includes(id) || result.skipped?.includes(id)) continue;
        try {
          const bytes = await desktopFiles.readImportAttachment(id, filename);
          await upload(id, filename, bytes, true);
        } catch (error) {
          failed.push(`${id} / ${filename} (${(error as Error).message})`);
        }
      }
      if (failed.length) retryAfter = Date.now() + 30000;
      else importedSnapshot = snapshot;
      return { conflicts: result.conflicts, failed };
    } catch (error) {
      retryAfter = Date.now() + 10000;
      throw error;
    } finally {
      importing = false;
    }
  }

  return {
    read,
    importChanges,
    chooseImport: async () => {
      if (!desktopFiles || !await desktopFiles.chooseImport()) return false;
      importedSnapshot = "";
      retryAfter = 0;
      return true;
    },
    async save(draft: DevTicketDraft): Promise<DevTicket[]> {
      return (await request("", json("POST", draft))).json();
    },
    async trash(id: string, deleted: boolean): Promise<DevTicket[]> {
      return (await request(`/${encodeURIComponent(id)}/trash`, json("PATCH", { deleted }))).json();
    },
    async deleteForever(id: string): Promise<DevTicket[]> {
      return (await request(`/${encodeURIComponent(id)}`, { method: "DELETE" })).json();
    },
    async addAttachments(id: string) {
      if (!desktopFiles) return null;
      const names = await desktopFiles.chooseAttachments();
      if (!names.length) return null;
      let saved = 0;
      const failures: string[] = [];
      for (const [index, name] of names.entries()) {
        try {
          await upload(id, name, await desktopFiles.readChosenAttachment(index));
          saved++;
        } catch (error) {
          failures.push(`${name} (${(error as Error).message})`);
        }
      }
      return { saved, failures, tickets: await read() };
    },
    async openAttachments(ticket: DevTicket, filename?: string) {
      if (!desktopFiles) return;
      for (const name of filename === undefined ? ticket.attachments : [filename]) {
        const response = await request(attachmentUrl(ticket.id, name));
        await desktopFiles.cacheAttachment(account, ticket.id, name, new Uint8Array(await response.arrayBuffer()));
      }
      await desktopFiles.revealAttachment(account, ticket.id, filename);
    },
    copy: (text: string) => desktopFiles ? desktopFiles.copy(text) : navigator.clipboard.writeText(text),
    paste: () => desktopFiles ? desktopFiles.paste() : navigator.clipboard.readText(),
  };
}
