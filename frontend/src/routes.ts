import { lazy } from "react";
import { Route } from "./types/app";
import { ProfileProvider } from "./contexts/ProfileContext";
import { ReviewsProvider } from "./contexts/ReviewsContext";
import { BooksProvider } from "./contexts/BooksContext";
import { BookProvider } from "./contexts/BookContext";
import { BookReviewProvider } from "./contexts/ReviewContext";
const HomePage = lazy(() => import("./pages/HomePage/HomePage"));
const ProfileDetails = lazy(
  () => import("./pages/ProfileDetails/ProfileDetails"),
);
const BooksPage = lazy(() => import("./pages/Books/BooksPage"));
const ReviewsPage = lazy(() => import("./pages/ReviewsPage/ReviewsPage"));
const BookDetails = lazy(() => import("./pages/BookDetails/BookDetails"));
const ReviewDetails = lazy(() => import("./pages/ReviewDetails/ReviewDetails"));
const BookEdit = lazy(() => import("./pages/BookEdit/BookEdit"));
const BookReviewEdit = lazy(() => import("./pages/ReviewEdit/ReviewEdit"));

const routes: Route[] = [
  {
    path: "/home",
    component: HomePage,
    authRequired: false,
  },
  {
    path: "/profile",
    component: ProfileDetails,
    authRequired: true,
    provider: ProfileProvider,
  },
  {
    path: "/books",
    component: BooksPage,
    authRequired: true,
    provider: BooksProvider,
  },
  {
    path: "/reviews",
    component: ReviewsPage,
    authRequired: true,
    provider: ReviewsProvider,
  },
  {
    path: "book/:id/:dataItemType?/:dataItemId?",
    component: BookDetails,
    authRequired: true,
    provider: BookProvider,
  },
  {
    path: "book-edit/:id/:dataItemType?/:dataItemId?",
    component: BookEdit,
    authRequired: true,
    provider: BookProvider,
  },
  {
    path: "review/:id",
    component: ReviewDetails,
    authRequired: true,
    provider: BookReviewProvider,
  },
  {
    path: "review-edit/:id",
    component: BookReviewEdit,
    authRequired: true,
    provider: BookReviewProvider,
  },
];

export { routes };
