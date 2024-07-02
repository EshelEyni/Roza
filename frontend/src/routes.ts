import { FC, LazyExoticComponent, lazy } from "react";
const HomePage = lazy(() => import("./pages/HomePage/HomePage"));
const ProfileDetails = lazy(
  () => import("./pages/ProfileDetails/ProfileDetails"),
);

export interface Route {
  path: string;
  component: LazyExoticComponent<FC>;
  nestedRoutes?: Route[];
  authRequired: boolean;
}

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
  },
];

export { routes };
