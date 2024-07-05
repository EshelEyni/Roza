import {
  BoodDataItemType,
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
  type: BoodDataItemType;
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

function getDefaultChapter(bookId: string): Chapter {
  return {
    bookId,
    id: "",
    name: "",
    sortOrder: 0,
    description: "",
    text: "",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function getDefaultCharacter(bookId: string): Character {
  return {
    bookId,
    id: "",
    name: "",
    description: "",
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function getDefaultTheme(bookId: string): Theme {
  return {
    bookId,
    id: "",
    name: "",
    description: "",
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function getDefaultPlotline(bookId: string): Plotline {
  return {
    bookId,
    id: "",
    name: "",
    description: "",
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function getDefaultNote(bookId: string): Note {
  return {
    bookId,
    sortOrder: 0,
    text: "",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export { getDefaultBook, getDefaultBookDataItem };
