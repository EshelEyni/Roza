import {
  BookDataItem,
  Chapter,
  Character,
  Note,
  Plotline,
  Theme,
} from "../types/books";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObject = { [key: string]: any };

const filterObj = (obj: AnyObject, ...allowedFields: string[]): AnyObject => {
  if (allowedFields.length === 0) return obj;
  return Object.keys(obj).reduce((newObj: AnyObject, key: string) => {
    if (allowedFields.includes(key)) {
      newObj[key] = obj[key];
    }
    return newObj;
  }, {} as AnyObject);
};

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

async function sendEmail(options: {
  email: string;
  subject: string;
  message: string;
}) {
  console.log(
    `Email sent to ${options.email} with subject: ${options.subject} and message: ${options.message}`
  );
}

export {
  AnyObject,
  filterObj,
  isChapterType,
  isCharacterType,
  isThemeType,
  isPlotlineType,
  isNoteType,
  sendEmail,
};
