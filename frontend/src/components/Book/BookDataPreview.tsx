import { FC } from "react";
import {
  BoodDataItemType,
  Chapter,
  Character,
  Note,
  Plotline,
  Theme,
} from "../../../../shared/types/books";
import { useTranslation } from "react-i18next";

type BookDataPreviewProps = {
  dataItem: Chapter | Character | Theme | Plotline | Note;
  type: BoodDataItemType;
};

export const BookDataPreview: FC<BookDataPreviewProps> = ({
  dataItem,
  type,
}) => {
  const { t } = useTranslation();

  function getTitle(dataItem: Chapter | Character | Theme | Plotline | Note) {
    switch (type) {
      case "chapters":
        return (dataItem as Character).name;
      case "characters":
        return (dataItem as Chapter).name;
      case "themes":
        return (dataItem as Theme).name;
      case "plotlines":
        return (dataItem as Plotline).name;
      case "notes":
        return `${t("NotePreview.titlePrefix")} ${dataItem.sortOrder}`;
    }
  }

  function getText(dataItem: Chapter | Character | Theme | Plotline | Note) {
    switch (type) {
      case "chapters":
        return (dataItem as Chapter).description;
      case "characters":
        return (dataItem as Character).description;
      case "themes":
        return (dataItem as Theme).description;
      case "plotlines":
        return (dataItem as Plotline).description;
      case "notes":
        return (dataItem as Note).text;
    }
  }

  const title = getTitle(dataItem);
  const text = getText(dataItem);

  return (
    <article className="scrollbar-hidden h-full max-h-[350px] cursor-pointer overflow-y-auto rounded-lg border border-app-900 p-4 shadow-lg transition duration-300 hover:scale-105 hover:shadow-xl">
      <h2 className="mb-4 text-xl font-bold text-app-800">{title}</h2>
      <p className="text-app-900">{text}</p>
    </article>
  );
};
