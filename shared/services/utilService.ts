import {
  BookDataItem,
  Chapter,
  Character,
  Note,
  Plotline,
  Theme,
} from "./../types/books";

function isChapterType(item: BookDataItem): item is Chapter {
  return item.type === "chapters";
}

function isCharacterType(item: BookDataItem): item is Character {
  return item.type === "characters";
}

function isThemeType(item: BookDataItem): item is Theme {
  return item.type === "themes";
}

function isPlotlineType(item: BookDataItem): item is Plotline {
  return item.type === "plotlines";
}

function isNoteType(item: BookDataItem): item is Note {
  return item.type === "notes";
}

export {
  isChapterType,
  isCharacterType,
  isThemeType,
  isPlotlineType,
  isNoteType,
};
