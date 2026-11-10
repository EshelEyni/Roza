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
  createdAt: Date | string;
}

export interface TaskCard {
  chapterId?: string;
  completed?: boolean;
  id: string;
  title: string;
  description: string;
  dueDate: string;
  checklist: { id: string; title: string; done: boolean }[];
  labels: { id: string; title: string; color: string }[];
  createdAt: string;
  updatedAt: string;
}
export interface TaskList {
  id: string;
  title: string;
  cards: TaskCard[];
}
export interface TaskBoard {
  lists: TaskList[];
}
export interface Book {
  taskBoard?: TaskBoard;
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
  isReadMode: boolean;
}

export interface BasicBookDataItem {
  readonly id: string;
  bookId: string;
  isArchived: boolean;
  createdAt: Date | string | number | null;
  updatedAt: Date | string | number | null;
}

export type BookDataItem = Chapter | Character | Theme | Plotline | Note;

export interface ChapterAnnotation {
  id: string;
  content: string;
  /** Slate range transformed with document operations; null means deleted text. */
  anchor: {
    anchor: { path: number[]; offset: number };
    focus: { path: number[]; offset: number };
  } | null;
  quote: string;
}

export type StoryKind = "themes" | "plotlines" | "characters";
export interface ChapterLink {
  entityId: string;
  note?: string;
}
export interface ChapterPlanning {
  themes: ChapterLink[];
  plotlines: ChapterLink[];
  characters: ChapterLink[];
}

export interface Chapter extends BasicBookDataItem {
  planning?: ChapterPlanning;
  format?: "prose" | "screenplay";
  annotations?: ChapterAnnotation[];
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
  color?: string;
  name: string;
  description: SlateCustomElement[];
  type: "themes";
}

export interface Plotline extends BasicBookDataItem {
  color?: string;
  name: string;
  description: SlateCustomElement[];
  type: "plotlines";
}

export interface Note extends BasicBookDataItem {
  name?: string;
  text: SlateCustomElement[];
  type: "notes";
}

export type BooKDataItemType =
  | "chapters"
  | "characters"
  | "themes"
  | "plotlines"
  | "notes";

export type ScreenplayType =
  | "scene_heading"
  | "action"
  | "character"
  | "dialogue"
  | "parenthetical"
  | "transition";
export interface ScreenplayElement extends BaseElement {
  type: ScreenplayType;
  children: SlateCustomText[];
}
export type SlateElementType =
  | ScreenplayType
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
  | ScreenplayElement
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
