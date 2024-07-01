import { AsyncLocalStorage } from "async_hooks";
import { alStoreType } from "../types/app";
const asyncLocalStorage = new AsyncLocalStorage();

function getLoggedInUserIdFromReq(): string {
  return (asyncLocalStorage.getStore() as alStoreType)?.loggedInUserId ?? "";
}

export { asyncLocalStorage, getLoggedInUserIdFromReq };
