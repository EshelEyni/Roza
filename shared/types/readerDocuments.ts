import type { SlateCustomElement } from "./books";

/** Long-form, book-level writing that is not attached to any passage. */
export interface ReaderDocumentSummary {
  id: string;
  title: string;
  preview: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReaderDocument extends ReaderDocumentSummary {
  content: SlateCustomElement[];
}

export interface ReaderDocumentUpdate {
  title?: string;
  content?: SlateCustomElement[];
}
