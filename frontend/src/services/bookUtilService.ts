import {
  BasicBookDataItem,
  BooKDataItemType,
  Book,
  BookDataItem,
  Chapter,
  Character,
  Note,
  Plotline,
  Theme,
} from "../../../shared/types/books";
import { getDefaultSlateElement } from "./utilService";

function getDefaultBook(userId = "", name = ""): Book {
  return {
    id: "",
    userId,
    name,
    chapters: [],
    characters: [],
    themes: [],
    plotlines: [],
    notes: [],
    filterBy: "chapters",
    createdAt: new Date(),
    updatedAt: new Date(),
    isArchived: false,
  };
}

function getDefaultBookDataItem({
  bookId,
  type,
}: {
  bookId: string;
  type: BooKDataItemType;
}): BookDataItem {
  switch (type) {
    case "chapters":
      return getDefaultChapter(bookId);
    case "characters":
      return getDefaultCharacter(bookId);
    case "themes":
      return getDefaultTheme(bookId);
    case "plotlines":
      return getDefaultPlotline(bookId);
    case "notes":
      return getDefaultNote(bookId);
    default:
      return getDefaultChapter(bookId);
  }
}

function getDefaultBasicBookDataItem(bookId: string): BasicBookDataItem {
  return {
    id: "",
    bookId,
    sortOrder: 0,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function getDefaultChapter(bookId: string): Chapter {
  return {
    ...getDefaultBasicBookDataItem(bookId),
    name: "",
    description: getDefaultSlateElement(),
    text: getDefaultSlateElement(),
    type: "chapters",
  };
}

function getDefaultCharacter(bookId: string): Character {
  return {
    ...getDefaultBasicBookDataItem(bookId),
    name: "",
    description: getDefaultSlateElement(),
    type: "characters",
  };
}

function getDefaultTheme(bookId: string): Theme {
  return {
    ...getDefaultBasicBookDataItem(bookId),
    name: "",
    description: getDefaultSlateElement(),
    type: "themes",
  };
}

function getDefaultPlotline(bookId: string): Plotline {
  return {
    ...getDefaultBasicBookDataItem(bookId),
    name: "",
    description: getDefaultSlateElement(),
    type: "plotlines",
  };
}

function getDefaultNote(bookId: string): Note {
  return {
    ...getDefaultBasicBookDataItem(bookId),
    text: getDefaultSlateElement(),
    type: "notes",
  };
}

const bookDataMapping: { [key in BooKDataItemType]: keyof Book } = {
  chapters: "chapters",
  characters: "characters",
  themes: "themes",
  plotlines: "plotlines",
  notes: "notes",
};

function updateBookData<T extends BookDataItem>({
  book,
  dataItemType,
  newItem,
}: {
  book: Book;
  dataItemType: BooKDataItemType;
  newItem: T;
}): Book {
  const key = bookDataMapping[dataItemType];
  return {
    ...book,
    [key]: (book[key] as T[]).map(item =>
      item.id === newItem.id ? newItem : item,
    ),
  };
}

function markItemAsDeleted({
  book,
  dataItemType,
  dataItemId,
}: {
  book: Book;
  dataItemType: BooKDataItemType;
  dataItemId: string;
}): Book {
  const key = bookDataMapping[dataItemType];
  return {
    ...book,
    [key]: (book[key] as BookDataItem[]).map(item =>
      item.id === dataItemId ? { ...item, isArchived: true } : item,
    ),
  };
}

export {
  getDefaultBook,
  getDefaultBookDataItem,
  updateBookData,
  markItemAsDeleted,
};
