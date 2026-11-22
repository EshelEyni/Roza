import type {
  ApproveResult,
  ChangeTextView,
  LiveBookOption,
  ReadView,
  SlateElement,
  StagedBookSummary,
  StagedBookView,
  StagingPrefs,
  StagingProjectInput,
} from "../../../../shared/types/stagingRoom";

const endpoint = "/api/staging-room";
const projectUrl = (slug: string) => "/projects/" + encodeURIComponent(slug);
const changeUrl = (slug: string, id: string) => projectUrl(slug) + "/changes/" + encodeURIComponent(id);

async function request<T>(url: string, method = "GET", data?: unknown): Promise<T> {
  const response = await fetch(endpoint + url, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    ...(data === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body === null) {
    const error = new Error(body?.message || body?.data?.message || `Staging Room request failed (${response.status}).`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return body;
}

export const api = {
  listBooks: () => request<StagedBookSummary[]>("/projects"),
  getPrefs: () => request<StagingPrefs>("/preferences"),
  setPrefs: (prefs: Partial<StagingPrefs>) => request<StagingPrefs>("/preferences", "PUT", prefs),
  liveBooks: () => request<LiveBookOption[]>("/live-books"),
  stageBook: (bookId: string) => request<{ slug: string }>("/projects", "POST", { bookId }),
  importProject: (project: StagingProjectInput) =>
    request<{ created: boolean }>("/projects/import", "POST", { project: JSON.stringify(project) }),
  getBook: (slug: string) => request<StagedBookView>(projectUrl(slug)),
  readChange: (slug: string, id: string) => request<ReadView>(changeUrl(slug, id)),
  getText: (slug: string, id: string) => request<ChangeTextView>(changeUrl(slug, id) + "/text"),
  saveText: (slug: string, id: string, text: SlateElement[], updatedAt: string) =>
    request<{ updatedAt: string }>(changeUrl(slug, id) + "/text", "PUT", { text, updatedAt }),
  approve: (slug: string, ids: string[], confirm = false) =>
    request<ApproveResult>(projectUrl(slug) + "/approve", "POST", { ids, confirm }),
  discard: (slug: string, ids: string[]) => request<{ discarded: number }>(projectUrl(slug) + "/discard", "POST", { ids }),
};

export const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Writing Studio's AI Edit, pointed at the staged text. */
export const stagingAiEditUrl = (slug: string) => endpoint + projectUrl(slug) + "/ai-edit";
