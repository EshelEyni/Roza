import { ReactNode } from "react";
import {
  SlateCustomElement,
  SlateCustomText,
} from "../../../../shared/types/books";

function renderNode(
  node: SlateCustomElement | SlateCustomText,
  key: number,
): ReactNode {
  if ("text" in node) {
    let content: ReactNode = node.text;
    if (node.bold) content = <strong>{content}</strong>;
    if (node.italic) content = <em>{content}</em>;
    if (node.underline) content = <u>{content}</u>;
    return <span key={key}>{content}</span>;
  }
  const children = node.children.map(renderNode);
  const props = { style: { textAlign: node.align } };
  switch (node.type) {
    case "heading-one":
      return (
        <h2 key={key} {...props}>
          {children}
        </h2>
      );
    case "heading-two":
      return (
        <h3 key={key} {...props}>
          {children}
        </h3>
      );
    case "block-quote":
      return (
        <blockquote key={key} {...props}>
          {children}
        </blockquote>
      );
    case "bulleted-list":
      return (
        <ul key={key} {...props}>
          {children}
        </ul>
      );
    case "numbered-list":
      return (
        <ol key={key} {...props}>
          {children}
        </ol>
      );
    case "list-item":
      return (
        <li key={key} {...props}>
          {children}
        </li>
      );
    default:
      return (
        <p key={key} {...props}>
          {children}
        </p>
      );
  }
}

export function ManuscriptText({ value }: { value: SlateCustomElement[] }) {
  return (
    <div className="ws-prose ws-preview" dir="auto">
      {value.map(renderNode)}
    </div>
  );
}
