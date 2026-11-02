import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import BooksPage from "../../frontend/src/pages/Books/BooksPage";
import WritingStudio from "../../frontend/src/components/WritingStudio/WritingStudio";
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
        <Routes>
          <Route path="/books" element={<BooksPage />} />
          <Route path="/book-edit/:id" element={<WritingStudio />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
