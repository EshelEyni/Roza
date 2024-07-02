import { Suspense, lazy, useEffect } from "react";
import { Loader } from "./components/Loader";
import { Navigate, Route, Routes } from "react-router-dom";
import { routes } from "./routes";
import { useTranslation } from "react-i18next";
import { useLoginWithToken } from "./hooks/useLoginWithToken";
import { AuthGuard } from "./guards/AuthGuard";
import { Route as TypeOfRoute } from "./routes";

const PageNotFound = lazy(() => import("./pages/PageNotFound"));

function App() {
  const { i18n } = useTranslation();
  const { loggedInUser } = useLoginWithToken();

  function getRoutes() {
    return routes.map(route => (
      <Route key={route.path} path={route.path} element={geRouteElement(route)}>
        {getNestedRoutes(route)}
      </Route>
    ));
  }

  function getNestedRoutes(route: TypeOfRoute) {
    if (!route.nestedRoutes) return null;
    return route.nestedRoutes.map(r => (
      <Route key={r.path} path={r.path} element={geRouteElement(r)} />
    ));
  }

  function geRouteElement(route: TypeOfRoute) {
    return route.authRequired ? (
      <AuthGuard component={<route.component />} />
    ) : (
      <route.component />
    );
  }

  useEffect(() => {
    if (loggedInUser && loggedInUser.language) {
      i18n.changeLanguage(loggedInUser.language);
    } else i18n.changeLanguage(i18n.options.fallbackLng as string);
  }, [i18n, loggedInUser]);

  useEffect(() => {
    const direction = i18n.language === "he" ? "rtl" : "ltr";
    document.documentElement.setAttribute("dir", direction);
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    <Suspense fallback={<Loader isPageLoader={true} />}>
      <Routes>
        <Route index element={<Navigate replace to="/home" />} />
        {getRoutes()}
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
}

export default App;
