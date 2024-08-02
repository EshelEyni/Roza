import { FC } from "react";
import {
  SlateCustomElement,
  SlateCustomText,
} from "../../../../shared/types/books";

type MinimizedTextProps =
  | { textEl: SlateCustomElement[]; text?: never }
  | { text: string; textEl?: never };

export const MinimizedText: FC<MinimizedTextProps> = ({ textEl, text }) => {
  function getText() {
    if (text) return text;

    if (textEl) {
      return textEl
        .map(el => el.children.map(c => (c as SlateCustomText).text).join(""))
        .join(" ");
    }

    return "";
  }

  const displayText = getText();
  const truncatedText =
    displayText.length > 200 ? displayText.slice(0, 200) + "..." : displayText;

  return <p>{truncatedText}</p>;
};
