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
import { isChapterType } from "../../../shared/services/utilService";
import { downloadFile } from "../services/utilService";
import { PDFCreator } from "../services/pdfService/PDFCreator";

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
    chaptersTextElements: SlateCustomElement[][];
    updateBook: (newBook: Book) => void;
    onNavigateToEdit: () => void;
    onDeleteItem: () => void;
    onUpdateItem: (newItem: BookDataItem) => void;
    onGoToDetails: (params?: OnGoToDetailsParams) => void;
    onArchiveBook: () => void;
    onDownloadChapter: () => void;
    onSetReadMode: () => void;
    isReadMode: boolean;
  };

type BookDetailsParams = {
  id: string;
  dataItemType?: string;
  dataItemId?: string;
};

type BookProviderProps = {
  children: React.ReactNode;
};

type OnGoToDetailsParams = {
  isGoToRootPage?: boolean;
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
  const isReadMode = book?.isReadMode ?? false;
  const { getTitle, getText, getChapterText, getChapterTextEl, getTextEl } =
    useGetTitleTextBookItem();
  const { t } = useTranslation();

  const pageTitle = t(`DataBookItemTitle.${dataItemType}`);
  const itemTitle = getTitle(item, dataItemType);
  const text = getText(item, dataItemType);
  const chatperText = getChapterText(item);
  const textEl = getTextEl(item, dataItemType);
  const chatperTextEl = getChapterTextEl(item);
  const chaptersTextElements = book
    ? book.chapters.map(chapter => {
        return getChapterTextEl(chapter);
      })
    : [];

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

  function onGoToDetails({ isGoToRootPage = false }: OnGoToDetailsParams = {}) {
    if (!book || !dataItemType || !dataItemId || !item) return;
    let url = `/book/${book.id}`;
    if (isGoToRootPage) return navigate(url);
    if (dataItemType) url += `/${dataItemType}`;
    if (dataItemId) url += `/${dataItemId}`;
    navigate(url);
  }

  function onArchiveBook() {
    if (!book) return;
    updateBook({ ...book, isArchived: true });
    navigate("/books");
  }

  function onDownloadChapter() {
    if (!book || !dataItemType || !dataItemId || !item || !isChapterType(item))
      return;
    const pdfCreateor = new PDFCreator(loggedInUser?.language || "en");
    const chapterPdf = pdfCreateor.createBookChapterPdf({
      chapter: item,
    }) as Blob;

    const getChapterNumber = () =>
      book.chapters.findIndex(c => c.id === item.id) + 1 || 1;
    const fileName = item.name || `${t("chapter")}-${getChapterNumber()}`;

    downloadFile({ blob: chapterPdf, fileName });
  }

  function onSetReadMode() {
    if (!book) return;
    updateBook({ ...book, isReadMode: !book.isReadMode });
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
    isReadMode,
    bookDataItemTypes,
    item,
    pageTitle,
    itemTitle,
    text,
    chatperText,
    textEl,
    chatperTextEl,
    chaptersTextElements,
    updateBook,
    onNavigateToEdit,
    onDeleteItem,
    onUpdateItem,
    onGoToDetails,
    onArchiveBook,
    onDownloadChapter,
    onSetReadMode,
  };

  return <BookContext.Provider value={value}>{children}</BookContext.Provider>;
}

const useBook = () => {
  const context = useContext(BookContext);
  if (!context) throw new Error("useBook must be used within a BookProvider");

  return context;
};

export { BookProvider, useBook };
