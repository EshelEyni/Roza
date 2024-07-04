import { createContext, useContext, useState } from "react";
import { UseGetBooksResult, UseLoginWithTokenResult } from "../types/app";
import { useLoginWithToken } from "../hooks/reactQuery/get/useLoginWithToken";
import { useGetBooks } from "../hooks/reactQuery/get/useGetBooks";

type BooksContextType = UseLoginWithTokenResult &
  UseGetBooksResult & {
    sortOrder: string;
    searchTerm: string;
    onSortBooks: (order: string) => void;
    onSearchBooks: (keyword: string) => void;
  };

type BooksProviderProps = {
  children: React.ReactNode;
};

const BooksContext = createContext<BooksContextType | undefined>(undefined);

function BooksProvider({ children }: BooksProviderProps) {
  const [sortOrder, setSortOrder] = useState<string>("createdAt");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const {
    loggedInUser,
    isLoadingLoggedInUser,
    errorLoggedInUser,
    isSuccessLoggedInUser,
    isErrorLoggedInUser,
  } = useLoginWithToken();

  const {
    books,
    errorBooks,
    isLoadingBooks,
    isSuccessBooks,
    isErrorBooks,
    isNoBooks,
    isBooksAvailable,
  } = useGetBooks({
    enabled: !!loggedInUser,
    limit: 10000,
    sort: sortOrder,
    searchTerm,
  });

  function onSortBooks(order: string) {
    setSortOrder(order);
  }

  function onSearchBooks(keyword: string) {
    setSearchTerm(keyword);
  }

  const value: BooksContextType = {
    loggedInUser,
    isLoadingLoggedInUser,
    errorLoggedInUser,
    isSuccessLoggedInUser,
    isErrorLoggedInUser,
    books,
    errorBooks,
    isLoadingBooks,
    isSuccessBooks,
    isErrorBooks,
    isNoBooks,
    isBooksAvailable,
    sortOrder,
    searchTerm,
    onSortBooks,
    onSearchBooks,
  };

  return (
    <BooksContext.Provider value={value}>{children}</BooksContext.Provider>
  );
}

const useBooks = () => {
  const context = useContext(BooksContext);
  if (!context) throw new Error("useBooks must be used within a BooksProvider");

  return context;
};

export { BooksProvider, useBooks };
