import mongoose, { Document } from "mongoose";
import { BooKDataItemType, SlateCustomElement, SlateCustomText } from "../../../shared/types/books";

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
  lastVisitedPage: string;
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
  isArchived: boolean;
  isReadMode: boolean;
}

export interface IBasicBookDataItem extends Document {
  bookId: mongoose.Types.ObjectId;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IChapter extends IBasicBookDataItem {
  name: string;
  description: ISlateCustomElement[];
  text: ISlateCustomElement[];
  type: "chapters";
}

export interface ICharacter extends IBasicBookDataItem {
  name: string;
  description: ISlateCustomElement[];
  type: "characters";
}

export interface ITheme extends IBasicBookDataItem {
  name: string;
  description: ISlateCustomElement[];
  type: "themes";
}

export interface IPlotline extends IBasicBookDataItem {
  name: string;
  description: ISlateCustomElement[];
  type: "plotlines";
}

export interface INote extends IBasicBookDataItem {
  text: ISlateCustomElement[];
  type: "notes";
}

export interface IBookReview extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  reviews: IReview[];
  references: IReference[];
  structure: ISlateCustomElement[];
  sortOrder: number;
  createdAt: Date | string | number | null;
  updatedAt: Date | string | number | null;
  isArchived: boolean;
}

export interface IReview extends Document {
  text: ISlateCustomElement[];
  isArchived: boolean;
  isMinimized: boolean;
  createdAt: Date | string | number | null;
  updatedAt: Date | string | number | null;
}

export interface IReference extends Document {
  pages: string;
  text: ISlateCustomElement[];
  imgs: string[];
  isArchived: boolean;
  isMinimized: boolean;
  createdAt: Date | string | number | null;
  updatedAt: Date | string | number | null;
}

export type ISlateCustomElement = SlateCustomElement & Document;

export interface ISlateCustomText extends SlateCustomText, Document {}
