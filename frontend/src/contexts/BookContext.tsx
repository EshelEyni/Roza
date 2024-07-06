import { createContext, useContext } from "react";
import { UseGetBookResult, UseLoginWithTokenResult } from "../types/app";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useGetBook } from "../hooks/reactQuery/get/useGetBook";
import { useParams } from "react-router-dom";
import { useLoginWithToken } from "../hooks/reactQuery/get/useLoginWithToken";

type BookContextType = UseLoginWithTokenResult &
  UseGetBookResult & {
    dataItem?: string;
    dataItemId?: string;
  };

type BookDetailsParams = {
  id: string;
  dataItem?: string;
  dataItemId?: string;
};

type BookProviderProps = {
  children: React.ReactNode;
};

const BooksContext = createContext<BookContextType | undefined>(undefined);

function BookProvider({ children }: BookProviderProps) {
  const params = useParams<BookDetailsParams>();

  const { id, dataItem, dataItemId } = params;

  const { book, errorBook, isErrorBook, isLoadingBook, isSuccessBook } =
    useGetBook(id);

  useDocumentTitle(`Roza / Book - ${book?.name || ""}`);

  const {
    loggedInUser,
    isLoadingLoggedInUser,
    errorLoggedInUser,
    isSuccessLoggedInUser,
    isErrorLoggedInUser,
  } = useLoginWithToken();

  const value: BookContextType = {
    loggedInUser,
    isLoadingLoggedInUser,
    errorLoggedInUser,
    isSuccessLoggedInUser,
    isErrorLoggedInUser,
    book,
    errorBook,
    isLoadingBook,
    isSuccessBook,
    isErrorBook,
    dataItem,
    dataItemId,
  };

  return (
    <BooksContext.Provider value={value}>{children}</BooksContext.Provider>
  );
}

const useBook = () => {
  const context = useContext(BooksContext);
  if (!context) throw new Error("useBook must be used within a BookProvider");

  return context;
};

export { BookProvider, useBook };
