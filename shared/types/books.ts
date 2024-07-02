export interface BookReview {
  id: string;
  userId: string;
  name: string;
  reviews: Review[];
  references: Reference[];
  sortOrder: number;
  createdAt: Date | string | number | null;
  updatedAt: Date | string | number | null;
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
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
}

export interface Chapter {
  bookId: string;
  name: string;
  sortOrder: number;
  description: string;
  text: string;
  createdAt: Date | string | number | null;
  updatedAt: Date | string | number | null;
}

export interface Character {
  bookId: string;
  name: string;
  description: string;
  sortOrder: number;
  createdAt: Date | string | number | null;
  updatedAt: Date | string | number | null;
}

export interface Theme {
  bookId: string;
  name: string;
  description: string;
  sortOrder: number;
  createdAt: Date | string | number | null;
  updatedAt: Date | string | number | null;
}

export interface Plotline {
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
