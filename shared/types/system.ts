import { Reference, Review, SlateCustomElement } from "./books";
import { User } from "./user";

export type AnyFunction = (...args: any[]) => any;

export type ServerErrorData = {
  status: string;
  message?: string;
  error?: {
    statusCode: number;
    status: string;
    isOperational: boolean;
  };
  stack?: string;
};

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

export type updateBookReviewEntityAction =
  | { type: "addReview" }
  | { type: "removeReview"; reviewId: string }
  | { type: "updateReview"; review: Review }
  | { type: "toggleMinimizeReviews"; isMinimized: boolean }
  | { type: "addReference" }
  | { type: "removeReference"; referenceId: string }
  | { type: "updateReference"; reference: Reference }
  | { type: "updateStructure"; structure: SlateCustomElement[] }
  | { type: "toggleMinimizeReferences"; isMinimized: boolean };

export type Tab = "display" | "edit" | "password";

export type Language = "en" | "he";