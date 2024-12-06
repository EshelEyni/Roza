import { Language } from "./system";

export interface UserCredenitials {
  username: string;
  fullname: string;
  password: string;
  passwordConfirm: string;
  email: string;
}

export interface UserCredenitialsWithId extends UserCredenitials {
  readonly id: string;
}

export interface User {
  readonly id: string;
  username: string;
  fullname: string;
  email: string;
  language: Language;
  roles: string[];
  lastVisitedPage: string;
  entityFilterOrder: {
    books: string;
    bookReviews: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}
