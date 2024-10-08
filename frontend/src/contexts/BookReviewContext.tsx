import { createContext, useContext } from "react";
import { UseGetBookReviewResult, UseLoginWithTokenResult } from "../types/app";
import { useNavigate, useParams } from "react-router-dom";
import { useLoginWithToken } from "../hooks/reactQuery/get/useLoginWithToken";
import { useGetBookReview } from "../hooks/reactQuery/get/useGetBookReview";
import { useUpdateBookReview } from "../hooks/reactQuery/update/useUpdateBookReview";
import {
  getDefaultReference,
  getDefaultReview,
} from "../services/bookReviewUtilService";
import { updateBookReviewEntityAction } from "../../../shared/types/system";
import { BookReview } from "../../../shared/types/books";

type BookReviewContextType = UseLoginWithTokenResult &
  UseGetBookReviewResult & {
    updateBookReview: (bookReview: BookReview) => void;
    onNavigateToEdit: () => void;
    onArchiveBookReview: () => void;
    updateBookReviewEntity: (action: updateBookReviewEntityAction) => void;
    getReviewNumber: (reviewId: string) => number | null;
  };

const BookReviewContext = createContext<BookReviewContextType | undefined>(
  undefined,
);

function BookReviewProvider({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const { id } = params;
  const navigate = useNavigate();
  const { updateBookReview } = useUpdateBookReview();

  const {
    bookReview,
    errorBookReview,
    isLoadingBookReview,
    isSuccessBookReview,
    isErrorBookReview,
  } = useGetBookReview(id);

  const {
    loggedInUser,
    isLoadingLoggedInUser,
    errorLoggedInUser,
    isSuccessLoggedInUser,
    isErrorLoggedInUser,
    isFetchedLoggedInUser,
  } = useLoginWithToken();

  function onNavigateToEdit() {
    if (!bookReview) return;
    navigate(`/review-edit/${bookReview.id}`);
  }

  function onArchiveBookReview() {
    if (!bookReview) return;
    updateBookReview({ ...bookReview, isArchived: true });
    navigate("/reviews");
  }

  function updateBookReviewEntity(action: updateBookReviewEntityAction) {
    if (!bookReview) return;

    const newBookReview = { ...bookReview };

    switch (action.type) {
      case "addReview":
        newBookReview.reviews.push(getDefaultReview());
        break;

      case "removeReview":
        newBookReview.reviews = newBookReview.reviews.map(review =>
          review.id === action.reviewId
            ? { ...review, isArchived: true }
            : review,
        );
        break;

      case "updateReview":
        newBookReview.reviews = newBookReview.reviews.map(r =>
          r.id === action.review.id ? action.review : r,
        );
        break;

      case "toggleMinimizeReviews":
        newBookReview.reviews = newBookReview.reviews.map(review => ({
          ...review,
          isMinimized: action.isMinimized,
        }));
        break;

      case "addReference":
        newBookReview.references.push(getDefaultReference());
        break;

      case "removeReference":
        newBookReview.references = newBookReview.references.map(reference =>
          reference.id === action.referenceId
            ? { ...reference, isArchived: true }
            : reference,
        );
        break;

      case "updateReference":
        newBookReview.references = newBookReview.references.map(r =>
          r.id === action.reference.id ? action.reference : r,
        );
        break;

      case "toggleMinimizeReferences":
        newBookReview.references = newBookReview.references.map(reference => ({
          ...reference,
          isMinimized: action.isMinimized,
        }));
        break;

      case "updateStructure":
        newBookReview.structure = action.structure;
        break;

      default:
        throw new Error("Unknown action type");
    }

    updateBookReview(newBookReview);
  }

  function getReviewNumber(reviewId: string) {
    if (!bookReview) return null;
    return bookReview.reviews.findIndex(r => r.id === reviewId) + 1;
  }

  const value = {
    bookReview,
    errorBookReview,
    isLoadingBookReview,
    isSuccessBookReview,
    isErrorBookReview,
    loggedInUser,
    isLoadingLoggedInUser,
    errorLoggedInUser,
    isSuccessLoggedInUser,
    isErrorLoggedInUser,
    isFetchedLoggedInUser,
    updateBookReview,
    onNavigateToEdit,
    onArchiveBookReview,
    updateBookReviewEntity,
    getReviewNumber,
  };

  return (
    <BookReviewContext.Provider value={value}>
      {children}
    </BookReviewContext.Provider>
  );
}

const useBookReview = () => {
  const context = useContext(BookReviewContext);
  if (!context) {
    throw new Error("useBookReview must be used within a BookReviewProvider");
  }
  return context;
};

export { BookReviewProvider, useBookReview };
