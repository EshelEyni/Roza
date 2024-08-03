import { FC } from "react";
import classnames from "classnames";
import { useSlate } from "slate-react";
import { TextEditorButton } from "../../types/app";
import { getIsActive, onFormatText } from "./textEditorService";

type TextEditorButtonProps = {
  button: TextEditorButton;
};

export const TextEditorBtn: FC<TextEditorButtonProps> = ({ button }) => {
  const editor = useSlate();
  const isActive = getIsActive(editor, button);

  function handleMouseDown(e: React.MouseEvent<HTMLSpanElement>) {
    e.preventDefault();
    onFormatText({ editor, button });
  }

  const { icon, format } = button;
  return (
    <button
      className={classnames("text-xl text-app-500", {
        "scale-125 text-app-800": isActive,
        "!text-2xl": format === "heading-one" || format === "heading-two",
      })}
      onMouseDown={handleMouseDown}
    >
      <span>{icon}</span>
    </button>
  );
};
