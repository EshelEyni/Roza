import { FC } from "react";
import { Button } from "./Button";
import { useTranslation } from "react-i18next";

type BtnMinimizeProps = {
  isMinimized: boolean;
  onToggleMinimize: () => void;
};

export const BtnMinimize: FC<BtnMinimizeProps> = ({
  isMinimized,
  onToggleMinimize,
}) => {
  const { t } = useTranslation();
  return (
    <Button onClickFn={onToggleMinimize}>
      {isMinimized ? t("btnMaximize") : t("btnMinimize")}
    </Button>
  );
};
