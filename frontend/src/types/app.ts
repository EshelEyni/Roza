import { FC, LazyExoticComponent, ReactElement, ReactNode } from "react";
import { Book, BookReview } from "../../../shared/types/books";

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
