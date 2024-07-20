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
  SlateCustomElement,
} from "../../../shared/types/books";
import { useGetTitleTextBookItem } from "../hooks/useGetTitleTextBookItem";
import { useTranslation } from "react-i18next";
import { useUpdateBook } from "../hooks/reactQuery/update/useUpdateBook";
import { markItemAsDeleted, updateBookData } from "../services/bookUtilService";

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
    textEl: SlateCustomElement[];
    chatperTextEl: SlateCustomElement[];
    onNavigateToEdit: () => void;
    onDeleteItem: () => void;
    onUpdateItem: (newItem: BookDataItem) => void;
    onGoToDetails: () => void;
    onArchiveBook: () => void;
  };

type BookDetailsParams = {
  id: string;
  dataItemType?: string;
  dataItemId?: string;
};

type BookProviderProps = {
  children: React.ReactNode;
};

const BookContext = createContext<BookContextType | undefined>(undefined);

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
  const { getTitle, getText, getChapterText, getChapterTextEl, getTextEl } =
    useGetTitleTextBookItem();
  const { t } = useTranslation();

  const pageTitle = t(`DataBookItemDetails.pageTitle.${dataItemType}`);
  const itemTitle = getTitle(item, dataItemType);
  const text = getText(item, dataItemType);
  const chatperText = getChapterText(item);
  const textEl = getTextEl(item, dataItemType);
  const chatperTextEl = getChapterTextEl(item);

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

  function onUpdateItem(newItem: BookDataItem) {
    if (!book || !dataItemType || !dataItemId || !item) return;

    const updatedBook = updateBookData({
      book,
      dataItemType: dataItemType as BooKDataItemType,

      newItem,
    });

    updateBook(updatedBook);
  }

  function onDeleteItem() {
    if (!book || !dataItemType || !dataItemId || !item) return;

    const updatedBook = markItemAsDeleted({
      book,
      dataItemType: dataItemType as BooKDataItemType,
      dataItemId,
    });

    updateBook(updatedBook);
    navigate(`/book/${book.id}`);
  }

  function onGoToDetails() {
    if (!book || !dataItemType || !dataItemId || !item) return;
    let url = `/book/${book.id}`;
    if (dataItemType) url += `/${dataItemType}`;
    if (dataItemId) url += `/${dataItemId}`;
    navigate(url);
  }

  function onArchiveBook() {
    if (!book) return;
    updateBook({ ...book, isArchived: true });
    navigate("/books");
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
    textEl,
    chatperTextEl,
    onNavigateToEdit,
    onDeleteItem,
    onUpdateItem,
    onGoToDetails,
    onArchiveBook,
  };

  return <BookContext.Provider value={value}>{children}</BookContext.Provider>;
}

const useBook = () => {
  const context = useContext(BookContext);
  if (!context) throw new Error("useBook must be used within a BookProvider");

  return context;
};

export { BookProvider, useBook };
