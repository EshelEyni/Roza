export interface BookReview {
  id: string;
  userId: string;
  name: string;
  reviews: Review[];
  references: Reference[];
  structure: SlateCustomElement[];
  sortOrder: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  isArchived: boolean;
}

export interface Review {
  readonly id: string;
  text: SlateCustomElement[];
  createdAt: Date | string;
  isArchived: boolean;
  isMinimized: boolean;
}

export interface Reference {
  readonly id: string;
  pages: string;
  text: SlateCustomElement[];
  imgs: string[];
  isArchived: boolean;
  isMinimized: boolean;
  sortOrder: number;
  createdAt: Date | string;
}

export interface Book {
  id: string;
  userId: string;
  name: string;
  chapters: Chapter[];
  characters: Character[];
  themes: Theme[];
  plotlines: Plotline[];
  notes: Note[];
  filterBy: BooKDataItemType;
  createdAt: Date | string;
  updatedAt: Date | string;
  isArchived: boolean;
}

export interface BasicBookDataItem {
  readonly id: string;
  bookId: string;
  sortOrder: number;
  isArchived: boolean;
  createdAt: Date | string | number | null;
  updatedAt: Date | string | number | null;
}

export type BookDataItem = Chapter | Character | Theme | Plotline | Note;

export interface Chapter extends BasicBookDataItem {
  name: string;
  description: SlateCustomElement[];
  text: SlateCustomElement[];
  type: "chapters";
}

export interface Character extends BasicBookDataItem {
  name: string;
  description: SlateCustomElement[];
  type: "characters";
}

export interface Theme extends BasicBookDataItem {
  name: string;
  description: SlateCustomElement[];
  type: "themes";
}

export interface Plotline extends BasicBookDataItem {
  name: string;
  description: SlateCustomElement[];
  type: "plotlines";
}

export interface Note extends BasicBookDataItem {
  text: SlateCustomElement[];
  type: "notes";
}

export type BooKDataItemType =
  | "chapters"
  | "characters"
  | "themes"
  | "plotlines"
  | "notes";

export type SlateElementType =
  | "paragraph"
  | "heading-one"
  | "heading-two"
  | "block-quote"
  | "bulleted-list"
  | "numbered-list"
  | "list-item";

export type SlateElementAlign = "left" | "center" | "right" | "justify";

interface BaseElement {
  type: SlateElementType;
  align?: SlateElementAlign;
}

export interface ListItemElement extends BaseElement {
  type: "list-item";
  children: SlateCustomText[];
}

export interface ListElement extends BaseElement {
  type: "bulleted-list" | "numbered-list";
  children: ListItemElement[];
}

export interface ParagraphElement extends BaseElement {
  type: "paragraph";
  children: SlateCustomText[];
}

export interface HeadingOneElement extends BaseElement {
  type: "heading-one";
  children: SlateCustomText[];
}

export interface HeadingTwoElement extends BaseElement {
  type: "heading-two";
  children: SlateCustomText[];
}

export interface BlockQuoteElement extends BaseElement {
  type: "block-quote";
  children: SlateCustomText[];
}

export type SlateCustomElement =
  | ListItemElement
  | ListElement
  | ParagraphElement
  | HeadingOneElement
  | HeadingTwoElement
  | BlockQuoteElement;

export interface SlateCustomText {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}
