import { FC, LazyExoticComponent, lazy } from "react";
const HomePage = lazy(() => import("./pages/HomePage/HomePage"));

interface Route {
  path: string;
  component: LazyExoticComponent<FC>;
  nestedRoutes?: Route[];
}

const routes: Route[] = [
  {
    path: "/home",
    component: HomePage,
  },
];

export { routes };
