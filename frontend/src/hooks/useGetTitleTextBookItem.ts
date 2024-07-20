import { useTranslation } from "react-i18next";
import {
  BookDataItem,
  Chapter,
  Character,
  Note,
  Plotline,
  SlateCustomElement,
  Theme,
} from "../../../shared/types/books";
import { getDefaultSlateElement } from "../services/utilService";
import {
  isChapterType,
  isNoteType,
} from "../../../shared/services/utilService";

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

  function getTextEl(
    dataItem: BookDataItem | null | undefined,
    type: string | null | undefined,
  ): SlateCustomElement[] {
    if (!type || !dataItem) return getDefaultSlateElement();
    const { description, text } = {
      description: t("useGetTitleTextBookItem.description"),
      text: t("useGetTitleTextBookItem.text"),
    };

    let itemText = "";

    switch (type) {
      case "chapters": {
        itemText = (dataItem as Chapter).description;
        break;
      }
      case "characters": {
        itemText = (dataItem as Character).description;
        break;
      }
      case "themes": {
        itemText = (dataItem as Theme).description;
        break;
      }
      case "plotlines": {
        itemText = (dataItem as Plotline).description;
        break;
      }
      case "notes": {
        itemText = (dataItem as Note).text;
        break;
      }
    }

    if (!itemText)
      return getDefaultSlateElement(isNoteType(dataItem) ? text : description);
    return JSON.parse(itemText);
  }

  function getChapterTextEl(
    dataItem: BookDataItem | null | undefined,
  ): SlateCustomElement[] {
    if (!dataItem || !isChapterType(dataItem) || !dataItem.text)
      return getDefaultSlateElement();
    return JSON.parse(dataItem.text) as SlateCustomElement[];
  }

  function getChapterText(dataItem: BookDataItem | null | undefined): string {
    if (!dataItem || !isChapterType(dataItem) || !dataItem.text) return "";
    const { text } = {
      text: t("useGetTitleTextBookItem.text"),
    };

    return (
      (JSON.parse(dataItem.text) as SlateCustomElement[])
        .map(el => el.children.map(c => c.text))
        .join(" ") || text
    );
  }

  function getText(
    dataItem: BookDataItem | null | undefined,
    type: string | null | undefined,
  ): string {
    if (!dataItem) return "";

    const { description, text } = {
      description: t("useGetTitleTextBookItem.description"),
      text: t("useGetTitleTextBookItem.text"),
    };

    let itemTextElStr = "";

    switch (type) {
      case "chapters": {
        itemTextElStr = (dataItem as Character).description;
        break;
      }
      case "characters": {
        itemTextElStr = (dataItem as Chapter).description;
        break;
      }
      case "themes": {
        itemTextElStr = (dataItem as Theme).description;
        break;
      }
      case "plotlines": {
        itemTextElStr = (dataItem as Plotline).description;
        break;
      }
      case "notes": {
        itemTextElStr = (dataItem as Note).text;
        break;
      }
    }

    if (!itemTextElStr) return isNoteType(dataItem) ? text : description;

    const parsedText = JSON.parse(itemTextElStr) as SlateCustomElement[];
    const itemText = parsedText
      .map(el => el.children.map(c => c.text))
      .join(" ");

    if (!itemText) return isNoteType(dataItem) ? text : description;
    return itemText;
  }

  return { getTitle, getText, getChapterText, getTextEl, getChapterTextEl };
}
