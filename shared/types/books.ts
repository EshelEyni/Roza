export interface BookReview {
  id: string;
  userId: string;
  name: string;
  reviews: Review[];
  references: Reference[];
  sortOrder: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Review {
  text: string;
  createdAt: Date | string | number | null;
}

export interface Reference {
  page: number;
  text: string;
  imgUrls: string[];
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
  text: string;
  name: string;
  description: string;
}

export interface Character extends BasicBookDataItem {
  name: string;
  description: string;
}

export interface Theme extends BasicBookDataItem {
  name: string;
  description: string;
}

export interface Plotline extends BasicBookDataItem {
  name: string;
  description: string;
}

export interface Note extends BasicBookDataItem {
  text: string;
}

export type BooKDataItemType =
  | "chapters"
  | "characters"
  | "themes"
  | "plotlines"
  | "notes";
