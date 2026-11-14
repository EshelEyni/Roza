import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../../frontend/public/locales/en/translation.json";
import { ReaderBookGrid } from "../../frontend/src/components/Reader/ReaderBookGrid";
import api from "../../frontend/src/services/readerApiService";
import "../../frontend/src/styles/app/_reader.scss";
await i18next
  .use(initReactI18next)
  .init({ lng: "en", resources: { en: { translation: en } } });
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});
client.setQueryData(["loggedInUser"], { id: "fixture" });
function Fixture() {
  const [archived, setArchived] = useState(false);
  const books = useQuery({
    queryKey: ["readerBooks", "fixture", archived],
    queryFn: () => api.query(archived),
  });
  return (
    <main className="reader-library">
      <button onClick={() => setArchived(!archived)}>
        {archived ? "Active Books" : "Archived Books"}
      </button>
      <ReaderBookGrid
        books={books.data || []}
        archived={archived}
        pending={false}
        onArchive={async (book) => {
          await api.setArchived(book.id, !archived);
          await client.invalidateQueries({ queryKey: ["readerBooks"] });
        }}
      />
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <BrowserRouter>
      <Fixture />
    </BrowserRouter>
  </QueryClientProvider>,
);
