import { FC } from "react";
import { RenderLeafProps } from "slate-react";

interface CustomLeaf {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface LeafProps extends RenderLeafProps {
  leaf: CustomLeaf;
}

export const Leaf: FC<LeafProps> = ({ attributes, children, leaf }) => {
  if (leaf.bold) children = <strong>{children}</strong>;
  if (leaf.italic) children = <em>{children}</em>;
  if (leaf.underline) children = <u>{children}</u>;
  return <span {...attributes}>{children}</span>;
};
