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

interface SlateEditorProps {
  defaultValue: Descendant[];
  onChange: (value: Descendant[]) => void;
}

export const SlateEditor: React.FC<SlateEditorProps> = ({
  defaultValue,
  onChange,
}) => {
  const editor = useMemo(() => withReact(createEditor()), []);
  const [value, setValue] = useState<Descendant[]>(defaultValue);
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

  return (
    <Slate editor={editor} initialValue={value} onChange={handleChange}>
      <TextEditorBtnList />

      <Editable
        renderElement={renderElement}
        renderLeaf={renderLeaf}
        spellCheck
        className={`min-h-[100px] w-full ${elMaxWidth} rounded-md border border-app-900 bg-gray-50 px-4 py-2 text-xl text-app-700`}
      />
    </Slate>
  );
};
