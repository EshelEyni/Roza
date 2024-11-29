"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertUser = assertUser;
exports.assertBook = assertBook;
exports.assertBookReview = assertBookReview;
function assertUser(user) {
    expect(user).toEqual(expect.objectContaining({
        id: expect.any(String),
        username: expect.any(String),
        fullname: expect.any(String),
        email: expect.any(String),
        language: expect.any(String),
    }));
    expect(typeof user.createdAt === "string" || typeof user.createdAt === "object").toBeTruthy();
}
function assertBook(book) {
    expect(book).toEqual(expect.objectContaining({
        id: expect.any(String),
        userId: expect.any(String),
        name: expect.any(String),
        chapters: expect.any(Array),
        characters: expect.any(Array),
        themes: expect.any(Array),
        plotlines: expect.any(Array),
        notes: expect.any(Array),
        filterBy: expect.any(String),
    }));
    expect(typeof book.createdAt === "string" || typeof book.createdAt === "object").toBeTruthy();
    expect(typeof book.updatedAt === "string" || typeof book.updatedAt === "object").toBeTruthy();
}
function assertBookReview(bookReview) {
    expect(bookReview).toEqual(expect.objectContaining({
        id: expect.any(String),
        userId: expect.any(String),
        name: expect.any(String),
        reviews: expect.any(Array),
        references: expect.any(Array),
        sortOrder: expect.any(Number),
    }));
    expect(typeof bookReview.createdAt === "string" || typeof bookReview.createdAt === "object").toBeTruthy();
    expect(typeof bookReview.updatedAt === "string" || typeof bookReview.updatedAt === "object").toBeTruthy();
}
//# sourceMappingURL=testAssertionService.js.map