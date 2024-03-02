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

export interface Book {
  _id: string;
  name: string;
  createdAt: Date | string | number | null;
  chapters: Chapter[];
}

export interface Chapter {
  _id: string;
  name: string;
  createdAt: Date | string | number | null;
  sortOrder: number;
  description: string;
  text: string;
}
