import { Suspense, lazy, useEffect } from "react";
import { Loader } from "./components/Loader";
import { Navigate, Route, Routes } from "react-router-dom";
import { routes } from "./routes";
import { useTranslation } from "react-i18next";
import { useLoginWithToken } from "./hooks/useLoginWithToken";

const PageNotFound = lazy(() => import("./pages/PageNotFound"));

function App() {
  const { i18n } = useTranslation();
  const { loggedInUser } = useLoginWithToken();

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
