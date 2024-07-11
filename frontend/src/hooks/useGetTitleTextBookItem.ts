import { useTranslation } from "react-i18next";
import {
  BookDataItem,
  Chapter,
  Character,
  Note,
  Plotline,
  Theme,
} from "../../../shared/types/books";

export function useGetTitleTextBookItem() {
  const { t } = useTranslation();

  function getTitle(
    dataItem: BookDataItem | null | undefined,
    type: string | null | undefined,
  ): string {
    if (!type || !dataItem) return "";

    const name = t(`useGetTitleTextBookItem.name.${type}`);

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
      default:
        return "";
    }
  }

  function getText(
    dataItem: BookDataItem | null | undefined,
    type: string | null | undefined,
  ): string {
    if (!type || !dataItem) return "";
    const { description, text } = {
      description: t("useGetTitleTextBookItem.description"),
      text: t("useGetTitleTextBookItem.text"),
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
      default:
        return "";
    }
  }
  return { getTitle, getText };
}
