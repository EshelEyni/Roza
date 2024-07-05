import { lazy } from "react";
import { Route } from "./types/app";
import { ProfileProvider } from "./contexts/ProfileContext";
import { ReviewsProvider } from "./contexts/ReviewsContext";
import { BooksProvider } from "./contexts/BooksContext";
import { BookProvider } from "./contexts/BookContext";
const HomePage = lazy(() => import("./pages/HomePage/HomePage"));
const ProfileDetails = lazy(
  () => import("./pages/ProfileDetails/ProfileDetails"),
);
const BooksPage = lazy(() => import("./pages/BooksPage/BooksPage"));
const ReviewsPage = lazy(() => import("./pages/ReviewsPage/ReviewsPage"));
const BookPage = lazy(() => import("./pages/Book/Book"));
const ReviewDetails = lazy(() => import("./pages/ReviewDetails/ReviewDetails"));

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
    path: "book/:id",
    component: BookPage,
    authRequired: true,
    provider: BookProvider,
  },
  {
    path: "reviews/:id",
    component: ReviewDetails,
    authRequired: true,
  },
];

export { routes };
