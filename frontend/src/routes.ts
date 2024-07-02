import { lazy } from "react";
import { Route } from "./types/app";
import { ProfileProvider } from "./contexts/ProfileContext";
const HomePage = lazy(() => import("./pages/HomePage/HomePage"));
const ProfileDetails = lazy(
  () => import("./pages/ProfileDetails/ProfileDetails"),
);

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
];

export { routes };
