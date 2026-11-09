import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
const en = await fetch("/locales/en/translation.json").then((response) =>
  response.json(),
);
import App from "../../frontend/src/App";
import "../../frontend/src/index.css";
import "../../frontend/src/styles/main.scss";
await i18next
  .use(initReactI18next)
  .init({
    lng: "en",
    fallbackLng: "en",
    resources: { en: { translation: en } },
  });
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});
client.setQueryData(["loggedInUser"], {
  id: "111111111111111111111111",
  language: "en",
});
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
