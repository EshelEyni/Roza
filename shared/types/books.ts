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
