import { BookReview } from "../../../shared/types/books";

function getDefaultBookReview(userId = "", name = ""): BookReview {
  return {
    id: "",
    userId,
    name,
    reviews: [],
    references: [],
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    isArchived: false,
  };
}

export { getDefaultBookReview };
