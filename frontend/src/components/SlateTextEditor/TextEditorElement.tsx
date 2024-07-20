import { FC } from "react";
import { RenderElementProps } from "slate-react";
import { SlateCustomElement } from "../../../../shared/types/books";

interface ElementProps extends RenderElementProps {
  element: SlateCustomElement;
}

export const TextEditorElement: FC<ElementProps> = ({
  attributes,
  children,
  element,
}) => {
  const style = { textAlign: element.align };
  switch (element.type) {
    case "block-quote":
      return (
        <blockquote style={style} {...attributes}>
          {children}
        </blockquote>
      );
    case "bulleted-list":
      return (
        <ul style={style} {...attributes} className="list-disc">
          {children}
        </ul>
      );
    case "heading-one":
      return (
        <h1 style={style} {...attributes} className="text-3xl">
          {children}
        </h1>
      );
    case "heading-two":
      return (
        <h2 style={style} {...attributes} className="text-2xl">
          {children}
        </h2>
      );
    case "list-item":
      return (
        <li
          style={{
            ...style,
            listStyle: "inherit",
            listStylePosition: "inside",
          }}
          {...attributes}
        >
          {children}
        </li>
      );
    case "numbered-list":
      return (
        <ol style={style} {...attributes} className="list-decimal">
          {children}
        </ol>
      );
    default:
      return (
        <p style={style} {...attributes}>
          {children}
        </p>
      );
  }
};
