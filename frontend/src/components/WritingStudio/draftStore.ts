import { Book } from "../../../../shared/types/books";

export type SaveState = "saved" | "pending" | "saving" | "error";
export type Recovery = { book: Book; base: string };

// One writer per mounted manuscript. Requests are serialized; newer local edits
// are never replaced by a response to an older snapshot.
export class DraftStore {
  book: Book;
  state: SaveState = "saved";
  error = "";
  storageError = false;
  recovery: Recovery | null = null;
  private readonly owner = crypto.randomUUID();
  private recoveryRaw: string | null = null;
  private revision = 0;
  private savedRevision = 0;
  private base: string;
  private running: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();
  readonly key: string;

  constructor(
    book: Book,
    private save: (book: Book) => Promise<Book>,
    private storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  ) {
    this.book = structuredClone(book);
    this.base = String(book.updatedAt);
    this.key = `roza:writing-draft:${book.userId}:${book.id}`;
    try {
      const raw = storage.getItem(this.key);
      if (raw) {
        this.recoveryRaw = raw;
        const draft = JSON.parse(raw) as Recovery;
        if (
          draft.book?.id === book.id &&
          draft.book.userId === book.userId &&
          Array.isArray(draft.book.chapters)
        )
          this.recovery = draft;
        else this.storageError = true;
      }
    } catch {
      this.storageError = true;
    }
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private emit() {
    this.listeners.forEach(listener => listener());
  }
  get dirty() {
    return this.revision !== this.savedRevision;
  }
  private persist() {
    try {
      this.storage.setItem(
        this.key,
        JSON.stringify({
          book: this.book,
          base: this.base,
          owner: this.owner,
          revision: this.revision,
        }),
      );
      this.storageError = false;
    } catch {
      this.storageError = true;
    }
  }
  edit = (change: (book: Book) => Book) => {
    if (this.recovery) return;
    this.book = change(this.book);
    this.revision++;
    this.persist();
    // Errors require explicit retry, rather than a loop of failing requests.
    if (this.state !== "error") {
      this.state = "pending";
      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        void this.flush();
      }, 700);
    }
    this.emit();
  };
  restore = () => {
    if (!this.recovery || this.recovery.base !== this.base) return;
    const draft = this.recovery.book;
    this.recovery = null;
    this.edit(() => draft);
  };
  discardRecovery = () => {
    try {
      if (this.storage.getItem(this.key) === this.recoveryRaw)
        this.storage.removeItem(this.key);
    } catch {
      this.storageError = true;
    }
    this.recovery = null;
    this.emit();
  };
  canRestore() {
    return this.recovery?.base === this.base;
  }
  flush = (): Promise<void> => {
    clearTimeout(this.timer);
    if (this.running) return this.running;
    if (!this.dirty || this.recovery) return Promise.resolve();
    this.running = this.drain().finally(() => {
      this.running = null;
    });
    return this.running;
  };
  private async drain() {
    while (this.dirty) {
      const revision = this.revision;
      const snapshot = structuredClone({ ...this.book, updatedAt: this.base });
      this.state = "saving";
      this.error = "";
      this.emit();
      try {
        const saved = await this.save(snapshot);
        if (!saved?.id || !saved.updatedAt)
          throw new Error("The server did not confirm the save.");
        this.base = String(saved.updatedAt);
        this.book = { ...this.book, updatedAt: saved.updatedAt };
        this.savedRevision = revision;
        if (this.dirty) this.persist();
        else {
          try {
            const raw = this.storage.getItem(this.key);
            const current = raw ? JSON.parse(raw) : null;
            if (current?.owner === this.owner && current.revision === revision)
              this.storage.removeItem(this.key);
          } catch {
            this.storageError = true;
          }
        }
      } catch (error) {
        this.state = "error";
        this.error =
          error instanceof Error && error.message
            ? error.message
            : "Unable to reach the server. Your edits have not been saved online.";
        this.persist();
        this.emit();
        return;
      }
    }
    this.state = "saved";
    this.emit();
  }
  dispose() {
    clearTimeout(this.timer);
    if (this.dirty) this.persist();
    this.listeners.clear();
  }
}
