import { createContext, useContext, useEffect, useState } from "react";
import { UseGetBookResult, UseLoginWithTokenResult } from "../types/app";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useGetBook } from "../hooks/reactQuery/get/useGetBook";
import { useNavigate, useParams } from "react-router-dom";
import { useLoginWithToken } from "../hooks/reactQuery/get/useLoginWithToken";
import {
  Book,
  BookDataItem,
  BooKDataItemType,
  Chapter,
} from "../../../shared/types/books";
import { useGetTitleTextBookItem } from "../hooks/useGetTitleTextBookItem";
import { useTranslation } from "react-i18next";
import { isChapterType } from "../../../shared/services/utilService";
import { useUpdateBook } from "../hooks/reactQuery/update/useUpdateBook";

type BookContextType = UseLoginWithTokenResult &
  UseGetBookResult & {
    dataItemType?: string;
    dataItemId?: string;
    filterBy: BooKDataItemType;
    isDetailsBookShowing: boolean;
    isDataItemDetailsShowing: boolean;
    bookDataItemTypes: BooKDataItemType[];
    item: BookDataItem | null;
    pageTitle: string;
    itemTitle: string;
    text: string;
    chatperText: string;
    onNavigateToEdit: () => void;
    onDeleteItem: () => void;
  };

type BookDetailsParams = {
  id: string;
  dataItemType?: string;
  dataItemId?: string;
};

type BookProviderProps = {
  children: React.ReactNode;
};

const BooksContext = createContext<BookContextType | undefined>(undefined);

function BookProvider({ children }: BookProviderProps) {
  const [item, setItem] = useState<BookDataItem | null>(null);
  const params = useParams<BookDetailsParams>();

  const { id, dataItemType, dataItemId } = params;

  const { book, errorBook, isErrorBook, isLoadingBook, isSuccessBook } =
    useGetBook(id);

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
    isSuccessBook && !!book && !dataItemType && !dataItemId;
  const isDataItemDetailsShowing =
    isSuccessBook &&
    !!book &&
    !!dataItemType &&
    !!dataItemId &&
    !!(book[dataItemType as keyof Book] as BookDataItem[]).find(
      i => i.id === dataItemId,
    );
  const { getTitle, getText } = useGetTitleTextBookItem();
  const { t } = useTranslation();

  const pageTitle = t(`DataBookItemDetails.pageTitle.${dataItemType}`);
  const itemTitle = getTitle(item, dataItemType);
  const text = getText(item, dataItemType);
  const chatperText =
    item && isChapterType(item) ? (item as Chapter)?.text : "";

  const { updateBook } = useUpdateBook();
  const navigate = useNavigate();
  useDocumentTitle(`Roza / Book - ${book?.name || ""}`);

  function onNavigateToEdit() {
    if (!book) return;
    let url = `/book-edit/${book.id}`;
    if (dataItemType) url += `/${dataItemType}`;
    if (dataItemId) url += `/${dataItemId}`;
    navigate(url);
  }

  function onDeleteItem() {
    if (!book || !dataItemType || !dataItemId || !item) return;
    function updateDeletedStatus<T extends { id: string }>(
      items: T[],
      id: string,
    ): T[] {
      return items.map(item =>
        item.id === id ? { ...item, isDeleted: true } : item,
      );
    }

    const newBook = { ...book };

    switch (dataItemType) {
      case "chapters":
        newBook.chapters = updateDeletedStatus(newBook.chapters, item.id);
        break;
      case "characters":
        newBook.characters = updateDeletedStatus(newBook.characters, item.id);
        break;
      case "themes":
        newBook.themes = updateDeletedStatus(newBook.themes, item.id);
        break;
      case "plotlines":
        newBook.plotlines = updateDeletedStatus(newBook.plotlines, item.id);
        break;
      case "notes":
        newBook.notes = updateDeletedStatus(newBook.notes, item.id);
        break;
    }

    updateBook(newBook);
  }

  useEffect(() => {
    if (!book || !dataItemType || !dataItemId) return;
    const item =
      ((book[dataItemType as keyof Book] as BookDataItem[]).find(
        i => i.id === dataItemId,
      ) as BookDataItem) || null;

    setItem(item);

    return () => {
      setItem(null);
    };
  }, [book, dataItemType, dataItemId]);

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
    dataItemType,
    dataItemId,
    filterBy,
    isDetailsBookShowing,
    isDataItemDetailsShowing,
    bookDataItemTypes,
    item,
    pageTitle,
    itemTitle,
    text,
    chatperText,
    onNavigateToEdit,
    onDeleteItem,
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
