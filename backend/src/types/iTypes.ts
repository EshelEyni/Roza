import mongoose, { Document } from "mongoose";
import { BookFilterBy } from "../../../shared/types/books";

export interface IUser extends Document {
  username: string;
  password: string;
  passwordConfirm: string;
  email: string;
  language: string;
  passwordChangedAt?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  fullname: string;
  roles: string[];
  createdAt: Date;
  updatedAt: Date;
  active: boolean;
  // eslint-disable-next-line no-unused-vars
  checkPassword: (candidatePassword: string, userPassword: string) => Promise<boolean>;
  // eslint-disable-next-line no-unused-vars
  changedPasswordAfter: (JWTTimestamp: number) => boolean;
  createPasswordResetToken: () => string;
  loginAttempts: number;
  lockedUntil: number;
}

export interface IBook extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  chapters: IChapter[];
  characters: ICharacter[];
  themes: ITheme[];
  plotlines: IPlotline[];
  notes: INote[];
  filterBy: BookFilterBy;
  createdAt: Date;
  updatedAt: Date;
}

export interface IChapter extends Document {
  bookId: mongoose.Types.ObjectId;
  name: string;
  sortOrder: number;
  description: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICharacter extends Document {
  bookId: mongoose.Types.ObjectId;
  name: string;
  description: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITheme extends Document {
  bookId: mongoose.Types.ObjectId;
  name: string;
  description: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPlotline extends Document {
  bookId: mongoose.Types.ObjectId;
  name: string;
  description: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface INote extends Document {
  bookId: mongoose.Types.ObjectId;
  text: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBookReview extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  reviews: IReview[];
  references: IReference[];
  sortOrder: number;
  createdAt: Date | string | number | null;
  updatedAt: Date | string | number | null;
}

export interface IReview extends Document {
  text: string;
  createdAt: Date | string | number | null;
  updatedAt: Date | string | number | null;
}

export interface IReference extends Document {
  page: number;
  text: string;
  imgUrls: string[];
  createdAt: Date | string | number | null;
  updatedAt: Date | string | number | null;
}
