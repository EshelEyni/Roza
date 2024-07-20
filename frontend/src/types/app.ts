import { FC, LazyExoticComponent, ReactElement, ReactNode } from "react";
import {
  Book,
  BookReview,
  SlateCustomElement,
  SlateCustomText,
} from "../../../shared/types/books";
import { User } from "../../../shared/types/user";
import { BaseEditor } from "slate";
import { ReactEditor } from "slate-react";

type RouteProvider = ({
  children,
}: {
  children: ReactNode;
}) => ReactElement<
  { children: ReactNode },
  string | ((props: unknown) => JSX.Element)
>;

export interface Route {
  path: string;
  component: LazyExoticComponent<FC>;
  nestedRoutes?: Route[];
  authRequired: boolean;
  provider?: RouteProvider;
}

export type UpdatePasswordParams = {
  currentPassword: string;
  newPassword: string;
  newPasswordConfirm: string;
};

export type UseGetBooksResult = {
  books: Book[] | undefined;
  errorBooks: unknown;
  isLoadingBooks: boolean;
  isSuccessBooks: boolean;
  isErrorBooks: boolean;
  isNoBooks: boolean;
  isBooksAvailable: boolean;
};

export type UseGetBookReviewsResult = {
  reviews: BookReview[] | undefined;
  errorReviews: unknown;
  isLoadingReviews: boolean;
  isSuccessReviews: boolean;
  isErrorReviews: boolean;
  isNoReviews: boolean;
  isReviewsAvailable: boolean;
};

export type UseLoginWithTokenResult = {
  loggedInUser: User | null | undefined;
  errorLoggedInUser: unknown;
  isLoadingLoggedInUser: boolean;
  isSuccessLoggedInUser: boolean;
  isErrorLoggedInUser: boolean;
  isFetchedLoggedInUser: boolean;
};

export type BookQueryParams = {
  sort: string;
  limit: number;
  searchTerm?: string;
};

export type ReviewQueryParams = {
  sort: string;
  limit: number;
  searchTerm?: string;
};

export type UseGetBookResult = {
  book: Book | undefined;
  errorBook: unknown;
  isLoadingBook: boolean;
  isSuccessBook: boolean;
  isErrorBook: boolean;
};

export type UseGetBookReviewResult = {
  bookReview: BookReview | undefined;
  errorBookReview: unknown;
  isLoadingBookReview: boolean;
  isSuccessBookReview: boolean;
  isErrorBookReview: boolean;
};

export type SlateEditor = BaseEditor & ReactEditor;

declare module "slate" {
  interface CustomTypes {
    Editor: SlateEditor;
    Element: SlateCustomElement;
    Text: SlateCustomText;
  }
}

export type MarkFormat = "bold" | "italic" | "underline";

export type BlockFormat =
  | "heading-one"
  | "heading-two"
  | "block-quote"
  | "numbered-list"
  | "bulleted-list"
  | "left"
  | "center"
  | "right"
  | "justify";

export type SlateEditorFormat = MarkFormat | BlockFormat;

export type TextEditorButton = MarkButton | BlockButton;

export type MarkButton = {
  format: MarkFormat;
  icon: JSX.Element;
  type: "mark";
};

export type BlockButton = {
  format: BlockFormat;
  icon: JSX.Element;
  type: "block";
};
