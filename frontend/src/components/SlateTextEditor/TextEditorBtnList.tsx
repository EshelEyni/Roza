import { FC } from "react";
import {
  FaAlignCenter,
  FaAlignJustify,
  FaAlignLeft,
  FaAlignRight,
  FaBold,
  FaItalic,
  FaListOl,
  FaListUl,
  FaQuoteRight,
  FaUnderline,
} from "react-icons/fa";
import { TbSquare1Filled, TbSquare2Filled } from "react-icons/tb";
import { TextEditorButton } from "../../types/app";
import { TextEditorBtn } from "./TextEditorBtn";

export const TextEditorBtnList: FC = () => {
  const btns: TextEditorButton[] = [
    {
      format: "bold",
      icon: <FaBold />,
      type: "mark",
    },
    {
      format: "italic",
      icon: <FaItalic />,
      type: "mark",
    },
    {
      format: "underline",
      icon: <FaUnderline />,
      type: "mark",
    },
    {
      format: "heading-one",
      icon: <TbSquare1Filled />,
      type: "block",
    },
    {
      format: "heading-two",
      icon: <TbSquare2Filled />,
      type: "block",
    },
    {
      format: "block-quote",
      icon: <FaQuoteRight />,
      type: "block",
    },
    {
      format: "numbered-list",
      icon: <FaListOl />,
      type: "block",
    },
    {
      format: "bulleted-list",
      icon: <FaListUl />,
      type: "block",
    },
    {
      format: "left",
      icon: <FaAlignLeft />,
      type: "block",
    },
    {
      format: "center",
      icon: <FaAlignCenter />,
      type: "block",
    },
    {
      format: "right",
      icon: <FaAlignRight />,
      type: "block",
    },
    {
      format: "justify",
      icon: <FaAlignJustify />,
      type: "block",
    },
  ];

  return (
    <ul
      className="flex w-full flex-wrap items-center justify-start gap-4"
      style={{ direction: "ltr" }}
    >
      {btns.map((b, i) => (
        <li key={i}>
          <TextEditorBtn button={b} />
        </li>
      ))}
    </ul>
  );
};
