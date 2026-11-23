import axios from "axios";
import { readOfflineBooks, saveOfflineBooks, withOfflineBook } from "./offlineBooks";
import {
  ReaderDictionaryLookup,
  ReaderLookupResult,
} from "../../../shared/types/readerDictionary";
import { ReaderBook, ReaderBookPage, ReaderLibrarySort, ReaderLibraryView, ReaderState } from "../../../shared/types/reader";
import { JsendResponse } from "../../../shared/types/system";
import type { BookPublishing, BookPublishingRequest } from "../../../shared/types/books";

const baseUrl = "/api/reader";

async function request<T>(
  method: string,
  path = "",
  data?: unknown,
  signal?: AbortSignal,
  offline?: (userId: string) => Promise<T | undefined>,
): Promise<T> {
  try {
    const network = async () => {
      const response = await axios<JsendResponse<T>>({
        method, url: baseUrl + path, data, signal, withCredentials: true,
      });
      return response.data.data as T;
    };
    return await (offline ? withOfflineBook(network, offline) : network());
  } catch (error) {
    if (axios.isAxiosError(error))
      throw new Error(
        error.response?.data?.message ||
          error.message ||
          "Reader request failed.",
      );
    throw error;
  }
}

async function upload(
  file: File,
  onProgress: (progress: number) => void,
): Promise<ReaderBook> {
  try {
    const response = await axios.post<JsendResponse<ReaderBook>>(
      baseUrl,
      file,
      {
        withCredentials: true,
        headers: {
          "Content-Type": "application/epub+zip",
          "X-Filename": encodeURIComponent(file.name),
        },
        onUploadProgress: event =>
          onProgress(
            Math.min(
              100,
              Math.round((event.loaded / (event.total || file.size)) * 100),
            ),
          ),
      },
    );
    return response.data.data!;
  } catch (error) {
    if (axios.isAxiosError(error))
      throw new Error(
        error.response?.data?.message || error.message || "Upload failed.",
      );
    throw error;
  }
}

async function fetchFile(id: string, signal: AbortSignal): Promise<ArrayBuffer> {
  const response = await axios.get<ArrayBuffer>(baseUrl + "/" + id + "/file", {
    withCredentials: true, responseType: "arraybuffer", signal,
  });
  return response.data;
}

async function getFile(id: string, signal: AbortSignal): Promise<ArrayBuffer> {
  try {
    return await withOfflineBook(
      () => fetchFile(id, signal),
      async userId => (await readOfflineBooks("reader", userId))?.find(entry => entry.book.id === id)?.file.arrayBuffer(),
    );
  } catch (error) {
    if (axios.isAxiosError(error))
      throw new Error(
        "Could not load this book. Check your connection and try again.",
      );
    throw error;
  }
}

function readingDate(book: ReaderBook) {
  return book.state.savedAt || Date.parse(book.createdAt);
}

function readingStatus(book: ReaderBook) {
  if (book.state.progress >= 1) return "finished";
  return book.state.progress > 0 || book.state.location ? "reading" : "unread";
}

async function offlinePage(
  view: ReaderLibraryView, sort: ReaderLibrarySort, search: string, cursor: string | null, resume: boolean, userId: string,
): Promise<ReaderBookPage | undefined> {
  const snapshot = await readOfflineBooks("reader", userId);
  if (!snapshot) return;
  const all = snapshot.map(entry => entry.book);
  const counts = { all: all.length, reading: 0, unread: 0, finished: 0 };
  for (const book of all) counts[readingStatus(book)]++;
  const term = search.trim().toLowerCase();
  const books = cursor || view === "archived" ? [] : all.filter(book =>
    (view === "all" || readingStatus(book) === view) &&
    (book.title.toLowerCase().includes(term) || book.author.toLowerCase().includes(term)),
  );
  books.sort((a, b) => {
    const pin = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
    if (pin) return pin;
    if (sort === "title" || sort === "author") return a[sort].localeCompare(b[sort]);
    if (sort === "added") return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    return readingDate(b) - readingDate(a);
  });
  return {
    books, counts, nextCursor: null,
    resume: resume ? all.find(book => readingStatus(book) === "reading") : undefined,
  };
}

export async function refreshOfflineReader(userId: string, signal: AbortSignal) {
  const previous = await readOfflineBooks("reader", userId);
  const { books } = await request<ReaderBookPage>("GET", "?sort=recent&ignorePins=true", undefined, signal);
  const saved = [];
  for (const book of books.slice(0, 8)) {
    const existing = previous?.find(entry => entry.book.id === book.id);
    // Published manuscripts can replace an EPUB in place.
    const unchanged = existing && (book.fileRevision
      ? existing.book.fileRevision === book.fileRevision
      : existing.book.updatedAt === book.updatedAt);
    const file = unchanged ? existing.file :
      new Blob([await fetchFile(book.id, signal)], { type: "application/epub+zip" });
    saved.push({ book, file });
  }
  if (!signal.aborted) await saveOfflineBooks("reader", userId, saved);
}

function saveOnLeave(id: string, state: ReaderState) {
  // keepalive survives normal route changes and page teardown; local retry data is retained too.
  return fetch(baseUrl + "/" + id + "/state", {
    method: "PATCH",
    credentials: "include",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  }).catch(() => undefined);
}

async function downloadStudioEpub(bookId: string, payload: BookPublishingRequest): Promise<Blob> {
  try {
    const response = await axios.post<Blob>(`${baseUrl}/studio/${bookId}/epub`, payload, {
      withCredentials: true,
      responseType: "blob",
    });
    return response.data;
  } catch (error) {
    let message = "Could not build the EPUB.";
    if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
      try {
        message = JSON.parse(await error.response.data.text()).message || message;
      } catch {
        /* Keep the general message. */
      }
    }
    throw new Error(message);
  }
}

export default {
  request,
  downloadStudioEpub,
  publishStudioBook: (bookId: string, payload: BookPublishingRequest) =>
    request<BookPublishing>("PUT", `/studio/${bookId}/publication`, payload),
  lookupWord: (id: string, selection: ReaderDictionaryLookup, signal = AbortSignal.timeout(15000)) =>
    request<ReaderLookupResult>("POST", "/" + id + "/dictionary", selection, signal),
  query: (view: ReaderLibraryView, sort: ReaderLibrarySort, search: string, cursor: string | null, signal?: AbortSignal, resume = false) => {
    const params = new URLSearchParams({ archived: String(view === "archived"), sort });
    if (view !== "all" && view !== "archived") params.set("status", view);
    if (!cursor) params.set("counts", "true");
    if (!cursor && resume) params.set("resume", "true");
    if (search) params.set("q", search);
    if (cursor) params.set("cursor", cursor);
    return request<ReaderBookPage>("GET", "?" + params, undefined, signal,
      userId => offlinePage(view, sort, search, cursor, resume, userId));
  },
  setPinned: (id: string, pinned: boolean) =>
    request<ReaderBook>("PATCH", "/" + id + "/pin", { pinned }),
  moveBook: (id: string, anchorId: string, placement: "before" | "after", archived: boolean) =>
    request<null>("PATCH", "/" + id + "/order", { anchorId, placement, archived }),
  setArchived: (id: string, archived: boolean) =>
    request<ReaderBook>("PATCH", "/" + id + "/archive", { archived }),
  rename: (id: string, title: string) => request<ReaderBook>("PATCH", "/" + id + "/title", { title }),
  deletePermanently: (id: string) => request<null>("DELETE", "/" + id),
  getById: (id: string) => request<ReaderBook>("GET", "/" + id, undefined, undefined, async userId =>
    (await readOfflineBooks("reader", userId))?.find(entry => entry.book.id === id)?.book),
  updateState: (id: string, state: ReaderState) =>
    request<ReaderState>("PATCH", "/" + id + "/state", state),
  upload,
  getFile,
  saveOnLeave,
};
