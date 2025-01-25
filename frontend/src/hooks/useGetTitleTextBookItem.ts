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
import {
  getDefaultSlateElement,
  getSlateElementText,
  isSlateElementEmpty,
} from "../services/utilService";
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

    const name = t(`placeholders.name.${type}`);

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
        return name;
      default:
        return "";
    }
  }

  function getTextEl(
    dataItem: BookDataItem | null | undefined,
    type: string | null | undefined,
  ): SlateCustomElement[] {
    if (!type || !dataItem) return getDefaultSlateElement();

    let itemText = null;

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

    if (!itemText || isSlateElementEmpty(itemText))
      return getDefaultSlateElement();

    return itemText;
  }

  function getChapterTextEl(
    dataItem: BookDataItem | null | undefined,
  ): SlateCustomElement[] {
    if (
      !dataItem ||
      !isChapterType(dataItem) ||
      !dataItem.text ||
      isSlateElementEmpty(dataItem.text)
    )
      return getDefaultSlateElement();
    return dataItem.text;
  }

  function getText(
    dataItem: BookDataItem | null | undefined,
    type: string | null | undefined,
  ): string {
    if (!dataItem) return "";

    const { description, text } = {
      description: t("placeholders.description"),
      text: t("placeholders.text"),
    };

    let itemText = null;

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

    if (!itemText) return isNoteType(dataItem) ? text : description;

    const itemTextStr = getSlateElementText(itemText);

    if (!itemTextStr) return isNoteType(dataItem) ? text : description;
    return itemTextStr;
  }

  return { getTitle, getText, getTextEl, getChapterTextEl };
}
