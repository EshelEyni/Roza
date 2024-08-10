import { createContext, useContext, useState } from "react";
import { UseGetBooksResult, UseLoginWithTokenResult } from "../types/app";
import { useLoginWithToken } from "../hooks/reactQuery/get/useLoginWithToken";
import { useGetBooks } from "../hooks/reactQuery/get/useGetBooks";
import { useIntersectionPagination } from "../hooks/useIntersectionPagination";

type BooksContextType = UseLoginWithTokenResult &
  UseGetBooksResult & {
    sortOrder: string;
    searchTerm: string;
    onSortBooks: (order: string) => void;
    onSearchBooks: (e: React.ChangeEvent<HTMLInputElement>) => void;
    intersectionRef: React.MutableRefObject<null>;
    paginationIdx: number;
  };

type BooksProviderProps = {
  children: React.ReactNode;
};

const BooksContext = createContext<BooksContextType | undefined>(undefined);

function BooksProvider({ children }: BooksProviderProps) {
  const [sortOrder, setSortOrder] = useState<string>("createdAt");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const { intersectionRef, paginationIdx } = useIntersectionPagination();

  const {
    loggedInUser,
    isLoadingLoggedInUser,
    errorLoggedInUser,
    isSuccessLoggedInUser,
    isErrorLoggedInUser,
    isFetchedLoggedInUser,
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
    limit: paginationIdx * 12,
    sort: sortOrder,
    searchTerm,
  });

  function onSortBooks(order: string) {
    setSortOrder(order);
  }

  function onSearchBooks(e: React.ChangeEvent<HTMLInputElement>) {
    const inputValue = e.target.value;
    setSearchTerm(!inputValue ? "" : inputValue);
  }

  const value: BooksContextType = {
    loggedInUser,
    isLoadingLoggedInUser,
    errorLoggedInUser,
    isSuccessLoggedInUser,
    isErrorLoggedInUser,
    isFetchedLoggedInUser,
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
    intersectionRef,
    paginationIdx,
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
