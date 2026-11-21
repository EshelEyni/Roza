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
    isReadMode: false,
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
    name: "",
    ...getDefaultBasicBookDataItem(bookId),
    text: getDefaultSlateElement(),
    type: "notes",
  };
}

export { getDefaultBook, getDefaultBookDataItem };
