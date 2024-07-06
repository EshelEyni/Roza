import { FC } from "react";
import {
  BooKDataItemType,
  Chapter,
  Character,
  Note,
  Plotline,
  Theme,
} from "../../../../shared/types/books";
import { useTranslation } from "react-i18next";

type BookDataPreviewProps = {
  dataItem: Chapter | Character | Theme | Plotline | Note;
  type: BooKDataItemType;
};

export const BookDataPreview: FC<BookDataPreviewProps> = ({
  dataItem,
  type,
}) => {
  const { t } = useTranslation();

  function getTitle(dataItem: Chapter | Character | Theme | Plotline | Note) {
    const name = t(`BookDataPreview.name.${type}`);

    switch (type) {
      case "chapters":
        return (dataItem as Character).name || name;
      case "characters":
        return (dataItem as Chapter).name || name;
      case "themes":
        return (dataItem as Theme).name || name;
      case "plotlines":
        return (dataItem as Plotline).name || name;
      case "notes":
        return `${t("BookDataPreview.noteTitlePrefix")} ${dataItem.sortOrder}`;
    }
  }

  function getText(dataItem: Chapter | Character | Theme | Plotline | Note) {
    const { description, text } = {
      description: t("BookDataPreview.description"),
      text: t("BookDataPreview.text"),
    };

    switch (type) {
      case "chapters":
        return (dataItem as Chapter).description || description;
      case "characters":
        return (dataItem as Character).description || description;
      case "themes":
        return (dataItem as Theme).description || description;
      case "plotlines":
        return (dataItem as Plotline).description || description;
      case "notes":
        return (dataItem as Note).text || text;
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
