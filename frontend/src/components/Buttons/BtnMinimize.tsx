import { FC } from "react";
import { Button } from "./Button";
import { useTranslation } from "react-i18next";
import { SlateCustomElement } from "../../../../shared/types/books";
import {
  getSlateElementText,
  MINIMZED_TEXT_LENGTH,
} from "../../services/utilService";

type BtnMinimizeProps = {
  isMinimized: boolean;
  onToggleMinimize: () => void;
  text?: SlateCustomElement[];
};

export const BtnMinimize: FC<BtnMinimizeProps> = ({
  isMinimized,
  onToggleMinimize,
  text,
}) => {
  const { t } = useTranslation();

  const textLength = text ? getSlateElementText(text).length : 0;
  const isShortText = textLength < MINIMZED_TEXT_LENGTH;

  if (text && isShortText) return null;
  return (
    <Button onClickFn={onToggleMinimize}>
      {isMinimized ? t("btnMaximize") : t("btnMinimize")}
    </Button>
  );
};
