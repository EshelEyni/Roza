import { FC } from "react";
import { SlateCustomElement } from "../../../../shared/types/books";
import {
  getSlateElementText,
  MINIMZED_TEXT_LENGTH,
} from "../../services/utilService";
import { useGetElMaxWidth } from "../../hooks/useGetElMaxWidth";

type MinimizedTextProps =
  | { textEl: SlateCustomElement[]; maxLength?: number; text?: never }
  | { text: string; maxLength?: number; textEl?: never };

export const MinimizedText: FC<MinimizedTextProps> = ({
  textEl,
  maxLength = MINIMZED_TEXT_LENGTH,
  text,
}) => {
  const { elMaxWidth } = useGetElMaxWidth({ width: 1000 });

  function getText() {
    if (text) return text;
    if (textEl) return getSlateElementText(textEl);
    return "";
  }

  const displayText = getText();
  const truncatedText =
    displayText.length > maxLength
      ? displayText.slice(0, maxLength) + "..."
      : displayText;

  return (
    <p
      className={`w-full whitespace-pre-wrap break-words text-base text-app-700`}
      style={{ maxWidth: elMaxWidth }}
    >
      {truncatedText}
    </p>
  );
};
