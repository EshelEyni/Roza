/* eslint-disable @typescript-eslint/no-explicit-any */
require("dotenv").config();
import mongoose from "mongoose";
import tokenService from "../token/tokenService";
import { ObjectId } from "mongodb";
import { getLoggedInUserIdFromReq } from "../ALSService";
import {
  Book,
  BooKDataItemType,
  BookReview,
  Chapter,
  Character,
  Note,
  Plotline,
  Reference,
  Review,
  Theme,
} from "../../types/books";
import { User, UserCredenitials } from "../../types/user";

type CreateTestUserOptions = {
  id?: string;
  isAdmin?: boolean;
};

type CreateTestBookOptions = {
  userId?: string;
  name?: string;
  chapters?: Chapter[];
  characters?: Character[];
  themes?: Theme[];
  plotlines?: Plotline[];
  notes?: Note[];
  filterBy?: BooKDataItemType;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

export interface CreateTestBookReviewOptions {
  id?: string;
  userId?: string;
  name?: string;
  reviews?: Review[];
  references?: Reference[];
  sortOrder?: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

function getUserCollection() {
  return mongoose.connection.collection("users");
}

async function createManyTestUsers(numOfUsers: number): Promise<User[]> {
  const ids = Array.from({ length: numOfUsers }, () => getMongoId());
  const userCollection = getUserCollection();
  await userCollection.deleteMany({
    _id: { $in: ids.map((id) => new ObjectId(id)) },
  });

  const userCreds = ids.map((id) => createValidUserCreds(id));

  const users = await userCollection.insertMany(userCreds);
  return users as unknown as User[];
}

async function deleteManyTestUsers(ids: string[]) {
  const userCollection = getUserCollection();
  await userCollection.deleteMany({
    _id: { $in: ids.map((id) => new ObjectId(id)) },
  });
}

async function createTestUser({
  id,
  isAdmin = false,
}: CreateTestUserOptions = {}): Promise<User> {
  const validId = id || getMongoId();
  const userCollection = getUserCollection();
  userCollection.deleteOne({ _id: new ObjectId(validId) });
  const user = createValidUserCreds(validId) as unknown as User;
  if (isAdmin) user.roles = ["admin"];
  const createdUset = await userCollection.insertOne(user);
  return createdUset as unknown as User;
}

async function deleteTestUser(id: string) {
  const userCollection = getUserCollection();
  userCollection.deleteOne({ _id: new ObjectId(id) });
  // await UserModel.findByIdAndDelete(id).setOptions({ active: false });
}

function getMongoId() {
  return new mongoose.Types.ObjectId().toHexString();
}

function createValidUserCreds(id?: string): UserCredenitials {
  function makeId(length = 10): string {
    let txt = "";
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < length; i++) {
      txt += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return txt;
  }
  const username = "testUser_" + makeId();
  const password = "password";
  return {
    _id: id || getMongoId(),
    username: username,
    fullname: "Test User",
    email: `${username}@testemail.com`,
    password,
    passwordConfirm: password,
    weight: 120,
    height: 180,
    gender: "male",
    birthdate: new Date("1990-01-01"),
  } as UserCredenitials;
}

function getLoginTokenStrForTest(validUserId: string) {
  const token = tokenService.signToken(validUserId);
  return `loginToken=${token}`;
}

function getMockedUser({
  id,
}: {
  id?: string | mongoose.Types.ObjectId;
} = {}) {
  return {
    _id: id?.toString() || getMongoId(),
    username: "test1",
    email: "email@email.com",
    fullname: "fullname1",
    imgUrl: "imgUrl1",
    isApprovedLocation: true,
    active: true,
    toObject: jest.fn().mockReturnThis(),
  };
}

function mockGetLoggedInUserIdFromReq(value?: string): string {
  const userId: string = value !== undefined ? value : getMongoId();
  (getLoggedInUserIdFromReq as jest.Mock).mockReturnValue(userId);
  return userId;
}

function createTestBook({
  userId,
  name,
  chapters,
  characters,
  themes,
  plotlines,
  notes,
  filterBy,
  createdAt,
  updatedAt,
}: CreateTestBookOptions = {}): Book {
  return {
    id: getMongoId(),
    userId: userId || getMongoId(),
    name: name || "Test Book",
    chapters: chapters || [],
    characters: characters || [],
    themes: themes || [],
    plotlines: plotlines || [],
    notes: notes || [],
    filterBy: filterBy || "chapters",
    createdAt: createdAt || new Date(),
    updatedAt: updatedAt || new Date(),
  };
}

function createTestBooks({
  num,
  userId,
}: {
  num: number;
  userId: string;
}): Book[] {
  return Array.from({ length: num }).map((_, i) =>
    createTestBook({
      name: `Test Book ${i + 1}`,
      userId,
    })
  );
}

function createTestBookReview({
  id,
  userId,
  name,
  reviews,
  references,
  sortOrder,
  createdAt,
  updatedAt,
}: CreateTestBookReviewOptions = {}): BookReview {
  return {
    id: id || getMongoId(),
    userId: userId || getMongoId(),
    name: name || "Test Book Review",
    reviews: reviews || [],
    references: references || [],
    sortOrder: sortOrder || 0,
    createdAt: createdAt || new Date(),
    updatedAt: updatedAt || new Date(),
  };
}

function createTestBookReviews({
  num,
  userId,
}: {
  num: number;
  userId: string;
}): BookReview[] {
  return Array.from({ length: num }).map((_, i) =>
    createTestBookReview({
      userId,
      name: `Test Book Review ${i + 1}`,
    })
  );
}

export {
  getLoginTokenStrForTest,
  mockGetLoggedInUserIdFromReq,
  createManyTestUsers,
  deleteManyTestUsers,
  createTestUser,
  createValidUserCreds,
  getMongoId,
  getMockedUser,
  deleteTestUser,
  createTestBook,
  createTestBooks,
  createTestBookReview,
  createTestBookReviews,
};
