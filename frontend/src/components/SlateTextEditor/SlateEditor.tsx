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
import { H2 } from "../App/H2";

interface SlateEditorProps {
  initialValue: Descendant[];
  onChange: (value: Descendant[]) => void;
  fullScreenTitle: string;
}

export const SlateEditor: React.FC<SlateEditorProps> = ({
  initialValue,
  onChange,
  fullScreenTitle,
}) => {
  const editor = useMemo(() => withReact(createEditor()), []);
  const [value, setValue] = useState<Descendant[]>(initialValue);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const { elMaxWidth } = useGetElMaxWidth({ width: 1000 });

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
        "fixed inset-0 z-50 flex h-full w-full flex-col items-center bg-app-100 py-20":
          isFullScreen,
      })}
    >
      {isFullScreen && <H2>{fullScreenTitle}</H2>}
      <Slate editor={editor} initialValue={value} onChange={handleChange}>
        <div
          className={classNames(
            `flex w-full justify-end gap-2 transition-all duration-300`,
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
            `min-h-[100px] w-full rounded-md border border-app-900 bg-gray-50 px-4 py-2 text-xl text-app-700 transition-all duration-300`,
            {
              "h-full": isFullScreen,
            },
          )}
          style={{ maxWidth: elMaxWidth }}
          onKeyDown={handleKeyDown}
        />
      </Slate>
    </div>
  );
};
