import { Suspense, lazy, useEffect, useState } from "react";
import { Loader } from "./components/Loaders/Loader";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useMatch,
  useNavigate,
} from "react-router-dom";
import { routes } from "./routes";
import { useTranslation } from "react-i18next";
import { useLoginWithToken } from "./hooks/reactQuery/get/useLoginWithToken";
import { AuthGuard } from "./guards/AuthGuard";
import { Route as TypeOfRoute } from "./types/app";
import { AppHeader } from "./components/App/AppHeader";
import { useUpdateUser } from "./hooks/reactQuery/update/useUpdateUser";
import { safeReturnPath } from "./services/readerMode";
import { DEFAULT_FAVICON, READER_FAVICON, useFavicon } from "./hooks/useFavicon";

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
  const isReaderOpen = !!useMatch("/reader/:id");
  const isStudioOpen = location.pathname.startsWith("/book-edit/");
  const isReadingRoom =
    location.pathname === "/reader" || location.pathname.startsWith("/reader/");
  useFavicon(isReadingRoom ? READER_FAVICON : DEFAULT_FAVICON);
  const isWritingArea =
    isStudioOpen ||
    location.pathname === "/books" ||
    location.pathname.startsWith("/book/");

  useEffect(() => {
    document.documentElement.classList.toggle(
      "writing-studio-open",
      isStudioOpen,
    );
    return () =>
      document.documentElement.classList.remove("writing-studio-open");
  }, [isStudioOpen]);

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

  const authReturnPath = safeReturnPath(
    (location.state as { from?: unknown } | null)?.from,
  );
  useEffect(() => {
    if (!loggedInUser) return;
    // A page that required login wins over the last visited page, query included.
    if (authReturnPath) {
      navigate(authReturnPath, { replace: true });
      setIsNavigatedToLastPage(true);
      return;
    }
    if (!loggedInUser.lastVisitedPage || isNavigatedToLastPage) return;
    // Re-navigating to the current path would drop its query (e.g. ?mode=) on refresh.
    if (loggedInUser.lastVisitedPage !== location.pathname)
      navigate(loggedInUser.lastVisitedPage);
    setIsNavigatedToLastPage(true);
  }, [navigate, loggedInUser, updateUser, isNavigatedToLastPage, authReturnPath, location.pathname]);

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
    <div
      className={
        isStudioOpen
          ? "app-writing-shell bg-[var(--roza-bg)] text-[color:var(--roza-ink)]"
          : `flex min-h-screen flex-col items-center bg-[var(--roza-bg)] text-[color:var(--roza-ink)] ${isWritingArea ? "" : "overflow-y-scroll"}`
      }
    >
      {!isReaderOpen && !isStudioOpen && <AppHeader />}
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
