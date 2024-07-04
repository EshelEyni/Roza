import { FC } from "react";
import {
  Chapter,
  Character,
  Note,
  Plotline,
  Theme,
} from "../../../../shared/types/books";
import { useTranslation } from "react-i18next";

type BookDataPreviewProps = {
  dataItem: Chapter | Character | Theme | Plotline | Note;
  type: "chapter" | "character" | "theme" | "plotline" | "note";
};

export const BookDataPreview: FC<BookDataPreviewProps> = ({
  dataItem,
  type,
}) => {
  const { t } = useTranslation();

  function getTitle(dataItem: Chapter | Character | Theme | Plotline | Note) {
    switch (type) {
      case "chapter":
        return (dataItem as Character).name;
      case "character":
        return (dataItem as Chapter).name;
      case "theme":
        return (dataItem as Theme).name;
      case "plotline":
        return (dataItem as Plotline).name;
      case "note":
        return `${t("NotePreview.titlePrefix")} ${dataItem.sortOrder}`;
    }
  }

  function getText(dataItem: Chapter | Character | Theme | Plotline | Note) {
    switch (type) {
      case "chapter":
        return (dataItem as Chapter).text;
      case "character":
        return (dataItem as Character).description;
      case "theme":
        return (dataItem as Theme).description;
      case "plotline":
        return (dataItem as Plotline).description;
      case "note":
        return (dataItem as Note).text;
    }
  }

  const title = getTitle(dataItem);
  const text = getText(dataItem);

  return (
    <article className="cursor-pointer rounded-lg border border-app-900 p-4">
      <h2 className="mb-4 text-xl font-bold text-app-800">{title}</h2>
      <p className="text-app-900">{text}</p>
    </article>
  );
};
