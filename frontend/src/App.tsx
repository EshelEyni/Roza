import { Suspense, lazy, useEffect, useRef, useState } from "react";
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

function readTabPage(key: string) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

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
  const [restoredAccountKey, setRestoredAccountKey] = useState<string | null>(null);
  const lastProfilePage = useRef<{ key: string; pathname: string } | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const currentPage = `${location.pathname}${location.search}${location.hash}`;
  const accountKey = loggedInUser ? `lastVisitedPage:${loggedInUser.id}` : null;
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
    if (!accountKey) {
      setRestoredAccountKey(null);
      lastProfilePage.current = null;
      return;
    }
    if (authReturnPath) {
      navigate(authReturnPath, { replace: true });
      setRestoredAccountKey(accountKey);
      return;
    }
    if (restoredAccountKey === accountKey) return;

    const tabPage = safeReturnPath(readTabPage(accountKey));
    const profilePage = safeReturnPath(loggedInUser?.lastVisitedPage);
    const savedPage =
      tabPage ?? (profilePage === location.pathname ? null : profilePage);
    if (savedPage && savedPage !== currentPage) {
      navigate(savedPage, { replace: true });
    }
    setRestoredAccountKey(accountKey);
  }, [
    accountKey,
    authReturnPath,
    currentPage,
    location.pathname,
    loggedInUser?.lastVisitedPage,
    navigate,
    restoredAccountKey,
  ]);

  useEffect(() => {
    if (authReturnPath || !accountKey || restoredAccountKey !== accountKey) return;
    try {
      window.sessionStorage.setItem(accountKey, currentPage);
    } catch {
      // The profile remains available when browser storage is blocked.
    }
  }, [accountKey, authReturnPath, currentPage, restoredAccountKey]);

  useEffect(() => {
    if (authReturnPath || !loggedInUser || !accountKey || restoredAccountKey !== accountKey)
      return;
    const pathname = location.pathname;
    const previousPage = lastProfilePage.current;
    if (previousPage?.key === accountKey && previousPage.pathname === pathname)
      return;

    lastProfilePage.current = { key: accountKey, pathname };
    if (loggedInUser.lastVisitedPage !== pathname) {
      updateUser({ ...loggedInUser, lastVisitedPage: pathname });
    }
  }, [accountKey, authReturnPath, location.pathname, loggedInUser, restoredAccountKey, updateUser]);

  return (
    <div
      className={
        isStudioOpen
          ? "app-writing-shell bg-app-100 text-app-800"
          : `flex min-h-screen flex-col items-center bg-app-100 text-gray-50 ${isWritingArea ? "" : "overflow-y-scroll"}`
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
