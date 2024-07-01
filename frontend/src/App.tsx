import { Suspense, lazy } from "react";
import { Loader } from "./components/Loader";
import { Navigate, Route, Routes } from "react-router-dom";
import { routes } from "./routes";

const PageNotFound = lazy(() => import("./pages/PageNotFound"));

function App() {
  return (
    <Suspense fallback={<Loader isPageLoader={true} />}>
      <Routes>
        <Route index element={<Navigate replace to="/home" />} />
        {routes.map((route, index) => (
          <Route key={index} path={route.path} element={<route.component />}>
            {route.nestedRoutes?.map((nestedRoute, index) => (
              <Route
                key={index}
                path={nestedRoute.path}
                element={<nestedRoute.component />}
              />
            ))}
          </Route>
        ))}
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
}

export default App;
