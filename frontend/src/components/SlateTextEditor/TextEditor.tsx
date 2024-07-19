import React, { useMemo, useState, useCallback } from "react";
import {
  Slate,
  Editable,
  withReact,
  RenderElementProps,
  RenderLeafProps,
} from "slate-react";
import { createEditor, Descendant } from "slate";
import { TextElement } from "./TextElement";
import { Leaf } from "./Leaf";
import { TextEditorBtnList } from "./TextEditorBtnList";

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

  const renderElement = useCallback(
    (props: RenderElementProps) => <TextElement {...props} />,
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
        className="min-h-[250px] w-full rounded-md border border-app-900 bg-gray-50 px-4 py-2 text-xl text-app-700"
      />
    </Slate>
  );
};
