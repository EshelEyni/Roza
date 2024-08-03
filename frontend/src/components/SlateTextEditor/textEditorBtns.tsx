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

export const btns: TextEditorButton[] = [
  {
    format: "bold",
    icon: <FaBold />,
    type: "mark",
    keyboardSequence: {
      key: "KeyB",
      ctrlKey: true,
    },
  },
  {
    format: "italic",
    icon: <FaItalic />,
    type: "mark",
    keyboardSequence: {
      key: "KeyI",
      ctrlKey: true,
    },
  },
  {
    format: "underline",
    icon: <FaUnderline />,
    type: "mark",
    keyboardSequence: {
      key: "KeyU",
      ctrlKey: true,
    },
  },
  {
    format: "heading-one",
    icon: <TbSquare1Filled />,
    type: "block",
    keyboardSequence: {
      key: "Digit1",
      ctrlKey: true,
    },
  },
  {
    format: "heading-two",
    icon: <TbSquare2Filled />,
    type: "block",
    keyboardSequence: {
      key: "Digit2",
      ctrlKey: true,
    },
  },
  {
    format: "block-quote",
    icon: <FaQuoteRight />,
    type: "block",
    keyboardSequence: {
      key: "KeyQ",
      ctrlKey: true,
    },
  },
  {
    format: "numbered-list",
    icon: <FaListOl />,
    type: "block",
    keyboardSequence: {
      key: "KeyL",
      ctrlKey: true,
    },
  },
  {
    format: "bulleted-list",
    icon: <FaListUl />,
    type: "block",
    keyboardSequence: {
      key: "KeyL",
      ctrlKey: true,
      shiftKey: true,
    },
  },
  {
    format: "left",
    icon: <FaAlignLeft />,
    type: "block",
    keyboardSequence: {
      key: "KeyL",
      ctrlKey: true,
      altKey: true,
    },
  },
  {
    format: "center",
    icon: <FaAlignCenter />,
    type: "block",
    keyboardSequence: {
      key: "KeyE",
      ctrlKey: true,
      altKey: true,
    },
  },
  {
    format: "right",
    icon: <FaAlignRight />,
    type: "block",
    keyboardSequence: {
      key: "KeyR",
      ctrlKey: true,
      altKey: true,
    },
  },
  {
    format: "justify",
    icon: <FaAlignJustify />,
    type: "block",
    keyboardSequence: {
      key: "KeyJ",
      ctrlKey: true,
      altKey: true,
    },
  },
];
