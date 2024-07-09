import { createContext, useContext } from "react";
import { UseGetBookResult, UseLoginWithTokenResult } from "../types/app";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useGetBook } from "../hooks/reactQuery/get/useGetBook";
import { useParams } from "react-router-dom";
import { useLoginWithToken } from "../hooks/reactQuery/get/useLoginWithToken";
import { Book, BookDataItem, BooKDataItemType } from "@rozaeyni/common-types";

type BookContextType = UseLoginWithTokenResult &
  UseGetBookResult & {
    dataItem?: string;
    dataItemId?: string;
    filterBy: BooKDataItemType;
    isDetailsBookShowing: boolean;
    isDataItemDetailsShowing: boolean;
    bookDataItemTypes: BooKDataItemType[];
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
    isFetchedLoggedInUser,
  } = useLoginWithToken();

  const bookDataItemTypes = [
    "chapters",
    "characters",
    "themes",
    "plotlines",
    "notes",
  ] as BooKDataItemType[];

  const filterBy = book?.filterBy || "chapters";
  const isDetailsBookShowing =
    isSuccessBook && !!book && !dataItem && !dataItemId;
  const isDataItemDetailsShowing =
    isSuccessBook &&
    !!book &&
    !!dataItem &&
    !!dataItemId &&
    !!(book[dataItem as keyof Book] as BookDataItem[]).find(
      i => i.id === dataItemId,
    );

  const value: BookContextType = {
    loggedInUser,
    isLoadingLoggedInUser,
    errorLoggedInUser,
    isSuccessLoggedInUser,
    isErrorLoggedInUser,
    isFetchedLoggedInUser,
    book,
    errorBook,
    isLoadingBook,
    isSuccessBook,
    isErrorBook,
    dataItem,
    dataItemId,
    filterBy,
    isDetailsBookShowing,
    isDataItemDetailsShowing,
    bookDataItemTypes,
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
