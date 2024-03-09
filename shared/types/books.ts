export interface BookReview {
  _id: string;
  name: string;
  reviews: Review[];
  references: Reference[];
  createdAt: Date | string | number | null;
  sortOrder: number;
}

export interface Review {
  text: string;
  createdAt: Date | string | number | null;
}

export interface Reference {
  page: number;
  text: string;
}

export type BookFilterBy =
  | "chapters"
  | "characters"
  | "themes"
  | "plotlines"
  | "notes";

export interface Book {
  _id: string;
  name: string;
  createdAt: Date | string | number | null;
  chapters: Chapter[];
  characters: Character[];
  filterBy: BookFilterBy;
}

export interface Chapter {
  bookId: string;
  name: string;
  createdAt: Date | string | number | null;
  sortOrder: number;
  description: string;
  text: string;
}

export interface Character {
  bookId: string;
  name: string;
  description: string;
  sortOrder: number;
}
