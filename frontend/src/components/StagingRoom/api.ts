import type { LogLine, StagingRoomApi } from "../../../../shared/types/stagingRoom";

const listeners = new Set<(line: LogLine) => void>();
const endpoint = "/api/staging-room";
const projectUrl = (slug: string) => "/projects/" + encodeURIComponent(slug);

async function request<T>(url: string, method = "GET", data?: unknown): Promise<T> {
  const response = await fetch(endpoint + url, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    ...(data === undefined ? {} : {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body === null) {
    throw new Error(body?.message || body?.data?.message || `Staging Room request failed (${response.status}).`);
  }
  return body;
}

async function sync<T>(url: string, options: unknown): Promise<T> {
  const { result, logs } = await request<{ result: T; logs: LogLine[] }>(url, "POST", options);
  for (const line of logs) for (const listener of listeners) listener(line);
  return result;
}

export const api: StagingRoomApi = {
  importProject: project => request("/projects/import", "POST", { project: JSON.stringify(project) }),
  listBooks: () => request("/projects"),
  getListPrefs: () => request("/preferences"),
  setListPrefs: prefs => request("/preferences", "PUT", prefs),
  getBook: slug => request(projectUrl(slug)),
  getChapter: (slug, file) => request(projectUrl(slug) + "/chapter?" + new URLSearchParams({ file })),
  connectionInfo: () => request("/connection"),
  testConnection: () => request("/connection/test"),
  prodStatus: slug => request(projectUrl(slug) + "/compare"),
  upload: (slug, options) => sync(projectUrl(slug) + "/push", options),
  pull: (slug, options) => sync(projectUrl(slug) + "/pull", options),
  onLog(listener) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

export const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
