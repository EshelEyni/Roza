import mongoose, { Document } from "mongoose";
import { BooKDataItemType } from "./books";

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
  filterBy: BooKDataItemType;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBasicBookDataItem extends Document {
  bookId: mongoose.Types.ObjectId;
  isDeleted: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IChapter extends IBasicBookDataItem {
  name: string;
  description: string;
  text: string;
  type: "chapters";
}

export interface ICharacter extends IBasicBookDataItem {
  name: string;
  description: string;
  type: "characters";
}

export interface ITheme extends IBasicBookDataItem {
  name: string;
  description: string;
  type: "themes";
}

export interface IPlotline extends IBasicBookDataItem {
  name: string;
  description: string;
  type: "plotlines";
}

export interface INote extends IBasicBookDataItem {
  text: string;
  type: "notes";
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