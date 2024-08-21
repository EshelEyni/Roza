import mongoose from "mongoose";
import { User, UserCredenitials } from "../../../../shared/types/user";
import { Book, BooKDataItemType, BookReview, Chapter, Character, Note, Plotline, Reference, Review, Theme } from "../../../../shared/types/books";
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
declare function createManyTestUsers(numOfUsers: number): Promise<User[]>;
declare function deleteManyTestUsers(ids: string[]): Promise<void>;
declare function createTestUser({ id, isAdmin }?: CreateTestUserOptions): Promise<User>;
declare function deleteTestUser(id: string): Promise<void>;
declare function getMongoId(): string;
declare function createValidUserCreds(id?: string): UserCredenitials;
declare function getLoginTokenStrForTest(validUserId: string): string;
declare function getMockedUser({ id, }?: {
    id?: string | mongoose.Types.ObjectId;
}): {
    _id: string;
    username: string;
    email: string;
    fullname: string;
    imgUrl: string;
    isApprovedLocation: boolean;
    active: boolean;
    toObject: jest.Mock<any, any, any>;
};
declare function mockGetLoggedInUserIdFromReq(value?: string): string;
declare function createTestBook({ userId, name, chapters, characters, themes, plotlines, notes, filterBy, createdAt, updatedAt, }?: CreateTestBookOptions): Book;
declare function createTestBooks({ num, userId }: {
    num: number;
    userId: string;
}): Book[];
declare function createTestBookReview({ id, userId, name, reviews, references, sortOrder, createdAt, updatedAt, }?: CreateTestBookReviewOptions): BookReview;
declare function createTestBookReviews({ num, userId }: {
    num: number;
    userId: string;
}): BookReview[];
export { getLoginTokenStrForTest, mockGetLoggedInUserIdFromReq, createManyTestUsers, deleteManyTestUsers, createTestUser, createValidUserCreds, getMongoId, getMockedUser, deleteTestUser, createTestBook, createTestBooks, createTestBookReview, createTestBookReviews, };
