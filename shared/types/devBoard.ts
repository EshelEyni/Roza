export type DevTicket = {
  id: string;
  number: number | null;
  project: string;
  title: string;
  status: string;
  priority: string;
  scope: string;
  repository: string;
  markdown: string;
  createdAt: string | null;
  deletedAt: string | null;
  attachments: string[];
};

export type DevTicketDraft = Omit<DevTicket, "id" | "createdAt" | "deletedAt" | "attachments"> & { id?: string };

export type DevBoardFiles = {
  readImport(): Promise<{ content: string; attachments: { id: string; filename: string }[] } | null>;
  chooseImport(): Promise<boolean>;
  readImportAttachment(id: string, filename: string): Promise<Uint8Array>;
  chooseAttachments(): Promise<string[]>;
  readChosenAttachment(index: number): Promise<Uint8Array>;
  cacheAttachment(account: string, id: string, filename: string, bytes: Uint8Array): Promise<void>;
  revealAttachment(account: string, id: string, filename?: string): Promise<void>;
  copy(text: string): Promise<void>;
  paste(): Promise<string>;
};
