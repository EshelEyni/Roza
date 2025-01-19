import { FC } from "react";
import {
  SlateCustomElement,
  SlateCustomText,
} from "../../../../shared/types/books";

type TextElementProps = {
  element: SlateCustomElement;
};

export const TextElement: FC<TextElementProps> = ({ element }) => {
  const style = { textAlign: element.align, minHeight: "1em" };

  const renderText = (c: SlateCustomText | SlateCustomElement, i?: number) => {
    if ("children" in c) return;
    if (c.bold) return <strong key={i}>{c.text}</strong>;
    if (c.italic) return <em key={i}>{c.text}</em>;
    if (c.underline) return <u key={i}>{c.text}</u>;
    return <span key={i}>{c.text}</span>;
  };

  switch (element.type) {
    case "paragraph":
      return (
        <p style={style} className="text-app-800">
          {element.children.map((c, i) => renderText(c, i))}
        </p>
      );
    case "heading-one":
      return (
        <h1 style={style} className="text-3xl text-app-800">
          {element.children.map((c, i) => renderText(c, i))}
        </h1>
      );
    case "heading-two":
      return (
        <h2 style={style} className="text-2xl text-app-800">
          {element.children.map((c, i) => renderText(c, i))}
        </h2>
      );
    case "block-quote":
      return (
        <blockquote style={style} className="text-app-800">
          {element.children.map((c, i) => renderText(c, i))}
        </blockquote>
      );
    case "bulleted-list":
      return (
        <ul style={style} className="list-disc text-app-800">
          {element.children.map((c, i) => (
            <TextElement key={i} element={c as SlateCustomElement} />
          ))}
        </ul>
      );
    case "numbered-list":
      return (
        <ol style={style} className="list-decimal text-app-800">
          {element.children.map((c, i) => (
            <TextElement key={i} element={c as SlateCustomElement} />
          ))}
        </ol>
      );
    case "list-item":
      return (
        <li
          className="text-app-800"
          style={{
            ...style,
            listStyle: "inherit",
            listStylePosition: "inside",
          }}
        >
          {element.children.map((c, i) => renderText(c, i))}
        </li>
      );
  }
};
