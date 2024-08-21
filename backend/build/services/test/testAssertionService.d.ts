import { Book, BookReview } from "../../../../shared/types/books";
import { User } from "../../../../shared/types/user";
declare function assertUser(user: User): void;
declare function assertBook(book: Book): void;
declare function assertBookReview(bookReview: BookReview): void;
export { assertUser, assertBook, assertBookReview };
