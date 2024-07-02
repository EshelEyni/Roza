import { lazy } from "react";
import { Route } from "./types/app";
import { ProfileProvider } from "./contexts/ProfileContext";
const HomePage = lazy(() => import("./pages/HomePage/HomePage"));
const ProfileDetails = lazy(
  () => import("./pages/ProfileDetails/ProfileDetails"),
);
const BooksPage = lazy(() => import("./pages/BooksPage/BooksPage"));
const ReviewsPage = lazy(() => import("./pages/ReviewsPage/ReviewsPage"));
const BookDetails = lazy(() => import("./pages/BookDetails/BookDetails"));
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
  },
  {
    path: "/reviews",
    component: ReviewsPage,
    authRequired: true,
  },
  {
    path: "books/:id",
    component: BookDetails,
    authRequired: true,
  },
  {
    path: "reviews/:id",
    component: ReviewDetails,
    authRequired: true,
  },
];

export { routes };
