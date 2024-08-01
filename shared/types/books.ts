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
}

export interface Reference {
  readonly id: string;
  page: string;
  text: SlateCustomElement[];
  imgs: string[];
  isArchived: boolean;
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
  isDeleted: boolean;
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

export interface SlateCustomElement {
  type: string;
  children: SlateCustomText[] | SlateCustomElement[];
  align?: "left" | "center" | "right" | "justify";
}

export interface SlateCustomText {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}
