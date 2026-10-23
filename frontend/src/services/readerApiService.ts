import axios from "axios";
import { ReaderBook, ReaderState } from "../../../shared/types/reader";
import { JsendResponse } from "../../../shared/types/system";

const baseUrl =
  process.env.NODE_ENV === "production"
    ? "/api/reader"
    : "http://localhost:3030/api/reader";

async function request<T>(
  method: string,
  path = "",
  data?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  try {
    const response = await axios<JsendResponse<T>>({
      method,
      url: baseUrl + path,
      data,
      signal,
      withCredentials: true,
    });
    return response.data.data as T;
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

async function getFile(id: string, signal: AbortSignal): Promise<ArrayBuffer> {
  try {
    const response = await axios.get<ArrayBuffer>(
      baseUrl + "/" + id + "/file",
      {
        withCredentials: true,
        responseType: "arraybuffer",
        signal,
      },
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error))
      throw new Error(
        "Could not load this book. Check your connection and try again.",
      );
    throw error;
  }
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

export default {
  getAccess: () => request<{ enabled: boolean }>("GET", "/access"),
  query: () => request<ReaderBook[]>("GET"),
  getById: (id: string) => request<ReaderBook>("GET", "/" + id),
  updateState: (id: string, state: ReaderState) =>
    request<ReaderState>("PATCH", "/" + id + "/state", state),
  upload,
  getFile,
  saveOnLeave,
};
