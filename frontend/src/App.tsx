import { Suspense, lazy, useEffect, useState } from "react";
import { Loader } from "./components/Loaders/Loader";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { routes } from "./routes";
import { useTranslation } from "react-i18next";
import { useLoginWithToken } from "./hooks/reactQuery/get/useLoginWithToken";
import { AuthGuard } from "./guards/AuthGuard";
import { Route as TypeOfRoute } from "./types/app";
import { AppHeader } from "./components/App/AppHeader";
import { useUpdateUser } from "./hooks/reactQuery/update/useUpdateUser";

const PageNotFound = lazy(() => import("./pages/PageNotFound"));

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
  const component = route.provider ? (
    <route.provider>
      <route.component />
    </route.provider>
  ) : (
    <route.component />
  );

  return route.authRequired ? <AuthGuard component={component} /> : component;
}

function App() {
  const { i18n } = useTranslation();
  const { loggedInUser, isFetchedLoggedInUser } = useLoginWithToken();
  const { updateUser } = useUpdateUser();
  const [isNavigatedToLastPage, setIsNavigatedToLastPage] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loggedInUser && loggedInUser.language && isFetchedLoggedInUser) {
      i18n.changeLanguage(loggedInUser.language);
    } else i18n.changeLanguage(i18n.options.fallbackLng as string);
  }, [i18n, loggedInUser, isFetchedLoggedInUser]);

  useEffect(() => {
    const direction = i18n.language === "he" ? "rtl" : "ltr";
    document.documentElement.setAttribute("dir", direction);
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  useEffect(() => {
    if (
      !loggedInUser ||
      !loggedInUser?.lastVisitedPage ||
      isNavigatedToLastPage
    )
      return;
    navigate(loggedInUser.lastVisitedPage);
    setIsNavigatedToLastPage(true);
  }, [navigate, loggedInUser, updateUser, isNavigatedToLastPage]);

  useEffect(() => {
    if (!loggedInUser || loggedInUser?.lastVisitedPage === location.pathname)
      return;
    updateUser({ ...loggedInUser, lastVisitedPage: location.pathname });

    return () => {
      updateUser({ ...loggedInUser, lastVisitedPage: location.pathname });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center overflow-y-scroll bg-app-100 text-gray-50">
      <AppHeader />
      <Suspense fallback={<Loader isPageLoader={true} />}>
        <Routes>
          <Route index element={<Navigate replace to="/home" />} />
          {getRoutes()}
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default App;
