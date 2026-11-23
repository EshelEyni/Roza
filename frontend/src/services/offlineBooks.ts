import axios from "axios";
import type { User } from "../../../shared/types/user";
import type { ReaderBook } from "../../../shared/types/reader";
import type { Book, ManuscriptSummary } from "../../../shared/types/books";

const accountKey = "account";
const sessionDuration = 90 * 24 * 60 * 60 * 1000;

type Account = { user: User; expires: number };
type Snapshot = {
  reader: { book: ReaderBook; file: Blob }[];
  studio: { summary: ManuscriptSummary; book: Book }[];
};

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storage<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => Promise<T>,
): Promise<T | undefined> {
  try {
    const open = indexedDB.open("roza-offline-books", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("snapshots");
    const db = await result(open);
    try {
      // A completed download should survive closing the desktop app immediately.
      const transaction = db.transaction("snapshots", mode, { durability: "strict" });
      const finished = new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error);
      });
      const [value] = await Promise.all([operation(transaction.objectStore("snapshots")), finished]);
      return value;
    } finally {
      db.close();
    }
  } catch {
    return undefined;
  }
}

async function readAccount(store: IDBObjectStore): Promise<Account | undefined> {
  return result(store.get(accountKey));
}

function validUser(account?: Account) {
  return account && account.expires > Date.now() ? account.user : null;
}

export async function offlineAccount() {
  return validUser(await storage("readonly", readAccount));
}

export async function rememberOfflineAccount(user: User | null) {
  await storage("readwrite", async store => {
    const previous = (await readAccount(store))?.user.id;
    if (previous && previous !== user?.id) {
      store.delete(previous + ":reader");
      store.delete(previous + ":studio");
    }
    if (user) await result(store.put({ user, expires: Date.now() + sessionDuration }, accountKey));
    else await result(store.delete(accountKey));
  });
}

export function connectionFailed(error: unknown) {
  return axios.isAxiosError(error) && !error.response &&
    (error.code === "ERR_NETWORK" || error.code === "ECONNABORTED" || error.code === "ETIMEDOUT");
}

export async function readOfflineBooks<K extends keyof Snapshot>(area: K, expectedUserId?: string) {
  return storage("readonly", async store => {
    const userId = validUser(await readAccount(store))?.id;
    if (!userId || (expectedUserId && expectedUserId !== userId)) return;
    return result<Snapshot[K] | undefined>(store.get(userId + ":" + area));
  });
}

export async function saveOfflineBooks<K extends keyof Snapshot>(area: K, userId: string, books: Snapshot[K]) {
  await storage("readwrite", async store => {
    if (validUser(await readAccount(store))?.id === userId) {
      await result(store.put(books, userId + ":" + area));
    }
  });
}

export async function withOfflineBook<T>(
  network: () => Promise<T>,
  local: (userId: string) => Promise<T | undefined>,
): Promise<T> {
  const account = offlineAccount();
  try {
    return await network();
  } catch (error) {
    if (connectionFailed(error)) {
      const user = await account;
      if (user) {
        const cached = await local(user.id);
        if (cached !== undefined && (await offlineAccount())?.id === user.id) return cached;
      }
    }
    throw error;
  }
}
