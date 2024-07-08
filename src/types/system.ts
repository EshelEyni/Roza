import { User } from "./user";

export type AnyFunction = (...args: any[]) => any;

export interface JsendResponse<T = any> {
  status: string;
  requested_at?: string;
  result?: number;
  data?: T;
  message?: string;
}

export interface IAsyncLocalStorageStore {
  loggedInUser?: User;
}

export type alStoreType = Record<string, string>;

export interface ParsedReqQuery {
  [key: string]: string | undefined;
}

export interface UserMsg {
  type: "info" | "success" | "error" | "warning" | "";
  text: string;
  link?: {
    text?: string;
    url: string;
  };
  btn?: {
    text: string;
    fn: Function;
  };
}
