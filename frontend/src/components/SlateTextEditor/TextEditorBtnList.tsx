import { FC } from "react";
import { TextEditorBtn } from "./TextEditorBtn";
import { useLoginWithToken } from "../../hooks/reactQuery/get/useLoginWithToken";
import { btns } from "./textEditorBtns";

type TextEditorBtnListProps = {
  isFullScreen: boolean;
};

export const TextEditorBtnList: FC<TextEditorBtnListProps> = ({
  isFullScreen,
}) => {
  const { loggedInUser } = useLoginWithToken();

  const direction = loggedInUser?.language === "he" ? "ltr" : "rtl";
  return (
    <ul
      className="flex flex-wrap items-center justify-start gap-4"
      style={{ direction }}
    >
      {btns.map((b, i) => (
        <li key={i}>
          <TextEditorBtn button={b} isFullScreen={isFullScreen} />
        </li>
      ))}
    </ul>
  );
};
