import type { ReaderAiSettings } from "../../../shared/types/readerAiSettings";
import readerApiService from "./readerApiService";
export default {
  get: () => readerApiService.request<ReaderAiSettings>("GET", "/ai-settings"),
  save: (settings: ReaderAiSettings) =>
    readerApiService.request<ReaderAiSettings>(
      "PATCH",
      "/ai-settings",
      settings,
    ),
};
