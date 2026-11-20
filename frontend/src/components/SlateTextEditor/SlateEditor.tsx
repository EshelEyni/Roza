import React, { useMemo, useState, useCallback } from "react";
import {
  Slate,
  Editable,
  withReact,
  RenderElementProps,
  RenderLeafProps,
} from "slate-react";
import { createEditor, Descendant } from "slate";
import { TextEditorElement } from "./TextEditorElement";
import { Leaf } from "./Leaf";
import { TextEditorBtnList } from "./TextEditorBtnList";
import { useGetElMaxWidth } from "../../hooks/useGetElMaxWidth";
import { btns } from "./textEditorBtns";
import { onFormatText } from "./textEditorService";
import { BtnToggleFullScreen } from "../Buttons/BtnToggleFullScreen";
import classNames from "classnames";
import { H1 } from "../App/H1";
import { Hr } from "../App/Hr";
import { H4 } from "../App/H4";
import { useTranslation } from "react-i18next";

interface SlateEditorProps {
  initialValue: Descendant[];
  onChange: (value: Descendant[]) => void;
  fullScreenTitle: string;
  wordsCount?: number;
}

export const SlateEditor: React.FC<SlateEditorProps> = ({
  initialValue,
  onChange,
  fullScreenTitle,
  wordsCount,
}) => {
  const editor = useMemo(() => withReact(createEditor()), []);
  const [value, setValue] = useState<Descendant[]>(initialValue);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const { elMaxWidth } = useGetElMaxWidth({ width: 1000 });
  const { t } = useTranslation();

  const renderElement = useCallback(
    (props: RenderElementProps) => <TextEditorElement {...props} />,
    [],
  );
  const renderLeaf = useCallback(
    (props: RenderLeafProps) => <Leaf {...props} />,
    [],
  );

  const handleChange = (newValue: Descendant[]) => {
    setValue(newValue);
    onChange(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.code === "KeyF" && e.ctrlKey) {
      e.preventDefault();
      return onToggleFullScreen();
    }

    const button = btns.find(button => {
      const { key, ctrlKey, shiftKey, altKey } = button.keyboardSequence;

      return (
        e.code === key &&
        e.ctrlKey === !!ctrlKey &&
        e.shiftKey === !!shiftKey &&
        e.altKey === !!altKey
      );
    });

    if (button) {
      e.preventDefault();
      onFormatText({ editor, button });
    }
  };

  const onToggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  return (
    <div
      className={classNames({
        "fixed inset-0 z-50 flex w-full flex-col items-center bg-[var(--roza-bg)] px-4 py-6":
          isFullScreen,
      })}
    >
      {isFullScreen && (
        <div
          style={{ maxWidth: elMaxWidth }}
          className="mb-2 flex w-full flex-col items-center"
        >
          <H1 addedClass="!text-[2.5rem] !mb-0">{fullScreenTitle}</H1>
          <Hr />
        </div>
      )}
      <Slate editor={editor} initialValue={value} onChange={handleChange}>
        <div
          className={classNames(
            `mb-2 flex w-full items-center justify-end gap-2 transition-all duration-300`,
            {
              "mb-4 !justify-between": isFullScreen,
            },
          )}
          style={{ maxWidth: elMaxWidth }}
        >
          <BtnToggleFullScreen
            isFullScreen={isFullScreen}
            onToggleFullScreen={onToggleFullScreen}
          />
          <TextEditorBtnList isFullScreen={isFullScreen} />
        </div>

        <Editable
          renderElement={renderElement}
          renderLeaf={renderLeaf}
          spellCheck
          className={classNames(
            `ui-editor ui-editor-area max-h-[550px] w-full overflow-y-auto transition-all duration-300`,
            {
              "h-full": isFullScreen,
            },
          )}
          style={{ maxWidth: elMaxWidth }}
          onKeyDown={handleKeyDown}
        />
        {wordsCount !== undefined && (
          <div
            className="flex w-full transition-all duration-300"
            style={{ maxWidth: elMaxWidth }}
          >
            <H4>
              {wordsCount} {t("words")}
            </H4>
          </div>
        )}
      </Slate>
    </div>
  );
};
