import { BookReview, Reference, Review } from "../../../shared/types/books";
import { getDefaultSlateElement } from "./utilService";

function getDefaultBookReview(userId = "", name = ""): BookReview {
  return {
    id: "",
    userId,
    name,
    reviews: [],
    references: [],
    structure: getDefaultSlateElement(),
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    isArchived: false,
  };
}

function getDefaultReview(): Review {
  return {
    id: "",
    text: getDefaultSlateElement(),
    createdAt: new Date(),
    isArchived: false,
    isMinimized: false,
  };
}

function getDefaultReference(): Reference {
  return {
    id: "",
    text: getDefaultSlateElement(),
    imgs: [],
    pages: "",
    isArchived: false,
    createdAt: new Date(),
    isMinimized: false,
  };
}

export { getDefaultBookReview, getDefaultReview, getDefaultReference };
