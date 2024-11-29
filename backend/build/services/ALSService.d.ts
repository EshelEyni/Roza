import { AsyncLocalStorage } from "async_hooks";
declare const asyncLocalStorage: AsyncLocalStorage<unknown>;
declare function getLoggedInUserIdFromReq(): string;
export { asyncLocalStorage, getLoggedInUserIdFromReq };
