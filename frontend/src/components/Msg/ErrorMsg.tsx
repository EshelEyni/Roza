import { FC } from "react";
import { useTranslation } from "react-i18next";

type ErrorMsgProps = {
  msg?: string | null;
};

export const ErrorMsg: FC<ErrorMsgProps> = ({ msg = "" }) => {
  const { t } = useTranslation();
  console.error(msg);
  const msgToDisplay = msg || t("ErrorMsg.msg");
  return (
    <p className="my-1 text-xl text-red-500 sm:text-xl md:text-lg">
      {msgToDisplay}
    </p>
  );
};
