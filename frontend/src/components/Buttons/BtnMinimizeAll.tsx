import { FC } from "react";
import { Button } from "./Button";
import { useTranslation } from "react-i18next";

type BtnMinimizeAllProps = {
  isMinimized: boolean;
  onToggleMinimize: () => void;
};

export const BtnMinimizeAll: FC<BtnMinimizeAllProps> = ({
  isMinimized,
  onToggleMinimize,
}) => {
  const { t } = useTranslation();
  return (
    <Button onClick={onToggleMinimize}>
      {isMinimized ? t("btnMaximizeAll") : t("btnMinimizeAll")}
    </Button>
  );
};
