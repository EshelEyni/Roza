import { FC } from "react";
import { useTranslation } from "react-i18next";

type ErrorMsgProps = {
  msg?: string | null;
};

export const ErrorMsg: FC<ErrorMsgProps> = ({ msg = "" }) => {
  const { t } = useTranslation();
  console.error(msg);
  const msgToDisplay = msg || t("ErrorMsg.msg");
  return <p className="text-3xl text-red-700 md:text-lg">{msgToDisplay}</p>;
};
