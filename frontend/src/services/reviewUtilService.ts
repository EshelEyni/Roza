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
  };
}

function getDefaultReference({ sortOrder = 0 }): Reference {
  return {
    id: "",
    text: getDefaultSlateElement(),
    imgs: [],
    pages: "",
    isArchived: false,
    sortOrder,
    createdAt: new Date(),
  };
}

export { getDefaultBookReview, getDefaultReview, getDefaultReference };
