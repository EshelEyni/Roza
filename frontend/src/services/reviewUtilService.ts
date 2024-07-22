import { BookReview, Review } from "../../../shared/types/books";
import { getDefaultSlateElement } from "./utilService";

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

function getDefaultReview(): Review {
  return {
    id: "",
    text: JSON.stringify(getDefaultSlateElement()),
    createdAt: new Date(),
    isArchived: false,
  };
}

export { getDefaultBookReview, getDefaultReview };
