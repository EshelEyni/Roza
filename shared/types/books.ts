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

export type BookFilterBy =
  | "chapters"
  | "characters"
  | "themes"
  | "plotlines"
  | "notes";

export interface Book {
  id: string;
  userId: string;
  name: string;
  chapters: Chapter[];
  characters: Character[];
  themes: Theme[];
  plotlines: Plotline[];
  notes: Note[];
  filterBy: BookFilterBy;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export type BookDataItem = Chapter | Character | Theme | Plotline | Note;

export interface Chapter {
  readonly id: string;
  bookId: string;
  name: string;
  sortOrder: number;
  description: string;
  text: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Character {
  readonly id: string;
  bookId: string;
  name: string;
  description: string;
  sortOrder: number;
  createdAt: Date | string | number | null;
  updatedAt: Date | string | number | null;
}

export interface Theme {
  readonly id: string;
  bookId: string;
  name: string;
  description: string;
  sortOrder: number;
  createdAt: Date | string | number | null;
  updatedAt: Date | string | number | null;
}

export interface Plotline {
  readonly id: string;
  bookId: string;
  name: string;
  description: string;
  sortOrder: number;
  createdAt: Date | string | number | null;
  updatedAt: Date | string | number | null;
}

export interface Note {
  bookId: string;
  text: string;
  sortOrder: number;
  createdAt: Date | string | number | null;
  updatedAt: Date | string | number | null;
}

export type BoodDataItemType = "chapters" | "characters" | "themes" | "plotlines" | "notes";
