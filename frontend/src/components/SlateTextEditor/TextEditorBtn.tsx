import { FC } from "react";
import classnames from "classnames";
import { useSlate } from "slate-react";
import { TextEditorButton } from "../../types/app";
import { getIsActive, onFormatText } from "./textEditorService";

type TextEditorButtonProps = {
  button: TextEditorButton;
  isFullScreen: boolean;
};

export const TextEditorBtn: FC<TextEditorButtonProps> = ({
  button,
  isFullScreen,
}) => {
  const editor = useSlate();
  const isActive = getIsActive(editor, button);

  function handleMouseDown(e: React.MouseEvent<HTMLSpanElement>) {
    e.preventDefault();
    onFormatText({ editor, button });
  }

  const { icon, format } = button;
  return (
    <button
      type="button"
      aria-label={format.replace(/-/g, " ")}
      aria-pressed={isActive}
      className={classnames("ui-icon-btn ui-editor-btn", {
        "is-active": isActive,
        "!text-xl": isFullScreen,
      })}
      onMouseDown={handleMouseDown}
    >
      <span>{icon}</span>
    </button>
  );
};
