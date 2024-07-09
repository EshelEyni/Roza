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
} from "@rozaeyni/common-types";

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
    type: "chapters",
  };
}

function getDefaultCharacter(bookId: string): Character {
  return {
    ...getDefaultBasicBookDataItem(bookId),
    name: "",
    description: "",
    type: "characters",
  };
}

function getDefaultTheme(bookId: string): Theme {
  return {
    ...getDefaultBasicBookDataItem(bookId),
    name: "",
    description: "",
    type: "themes",
  };
}

function getDefaultPlotline(bookId: string): Plotline {
  return {
    ...getDefaultBasicBookDataItem(bookId),
    name: "",
    description: "",
    type: "plotlines",
  };
}

function getDefaultNote(bookId: string): Note {
  return {
    ...getDefaultBasicBookDataItem(bookId),
    text: "",
    type: "notes",
  };
}

export { getDefaultBook, getDefaultBookDataItem };
