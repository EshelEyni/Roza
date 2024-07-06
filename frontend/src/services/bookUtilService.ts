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
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function getDefaultChapter(bookId: string): Chapter {
  return {
    ...getDefaultBasicBookDataItem(bookId),
    name: "",
    description: "",
    text: "",
  };
}

function getDefaultCharacter(bookId: string): Character {
  return {
    ...getDefaultBasicBookDataItem(bookId),
    name: "",
    description: "",
  };
}

function getDefaultTheme(bookId: string): Theme {
  return {
    ...getDefaultBasicBookDataItem(bookId),
    name: "",
    description: "",
  };
}

function getDefaultPlotline(bookId: string): Plotline {
  return {
    ...getDefaultBasicBookDataItem(bookId),
    name: "",
    description: "",
  };
}

function getDefaultNote(bookId: string): Note {
  return {
    ...getDefaultBasicBookDataItem(bookId),
    text: "",
  };
}

export { getDefaultBook, getDefaultBookDataItem };
