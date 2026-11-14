import React from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../../frontend/public/locales/en/translation.json";
import type { ReaderBook } from "../../shared/types/reader";
import "../../frontend/src/styles/app/_reader.scss";
await i18next
  .use(initReactI18next)
  .init({ lng: "en", resources: { en: { translation: en } } });
const book: ReaderBook = {
  id: new URLSearchParams(window.location.search).get("book") || "navigation",
  title: "Navigation",
  author: "Fixture",
  cover: "",
  filename: "navigation.epub",
  size: 1000,
  createdAt: "2026-11-02",
  updatedAt: "2026-11-02",
  state: {
    location: "",
    progress: 0,
    savedAt: 0,
    preferences: {
      fontSize: 20,
      fontFamily: "serif",
      lineHeight: 1.7,
      width: "comfortable",
      theme: "sepia",
      flow: "paginated",
    },
  },
};

import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EpubReader } from "../../frontend/src/components/Reader/EpubReader";
const client = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, retry: false } },
});
client.setQueryData(["loggedInUser"], { id: "fixture" });
client.setQueryData(["readerAccess", "fixture"], { enabled: true });
function BookReader() {
  const { id = "navigation" } = useParams();
  return (
    <EpubReader
      key={id}
      book={{
        ...book,
        id,
        title: id === "navigation" ? "Navigation" : "Second book",
      }}
      userId="fixture"
    />
  );
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <BrowserRouter>
      <Routes>
        <Route path="/reader/:id" element={<BookReader />} />
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>,
);
