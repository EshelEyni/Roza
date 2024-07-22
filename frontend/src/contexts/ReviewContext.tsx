import { createContext, useContext } from "react";
import { UseGetBookReviewResult, UseLoginWithTokenResult } from "../types/app";
import { useNavigate, useParams } from "react-router-dom";
import { useLoginWithToken } from "../hooks/reactQuery/get/useLoginWithToken";
import { useGetBookReview } from "../hooks/reactQuery/get/useGetBookReview";
import { useUpdateBookReview } from "../hooks/reactQuery/update/updateReview";
import { getDefaultReview } from "../services/reviewUtilService";
import { Review } from "../../../shared/types/books";

type BookReviewContextType = UseLoginWithTokenResult &
  UseGetBookReviewResult & {
    onNavigateToEdit: () => void;
    onArchiveReview: () => void;
    onAddReview: () => void;
    onRemoveReview: (reviewId: string) => void;
    onUpdateReview: (review: Review) => void;
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

  function onArchiveReview() {
    if (!bookReview) return;
    updateBookReview({ ...bookReview, isArchived: true });
    navigate("/reviews");
  }

  function onAddReview() {
    if (!bookReview) return;
    const newBookReview = { ...bookReview };
    bookReview.reviews.push(getDefaultReview());
    updateBookReview(newBookReview);
  }

  function onRemoveReview(reviewId: string) {
    if (!bookReview) return;
    const newBookReview = { ...bookReview };
    newBookReview.reviews = newBookReview.reviews.map(review =>
      review.id === reviewId ? { ...review, isArchived: true } : review,
    );
    updateBookReview(newBookReview);
  }

  function onUpdateReview(review: Review) {
    if (!bookReview) return;
    const newBookReview = { ...bookReview };
    newBookReview.reviews = newBookReview.reviews.map(r =>
      r.id === review.id ? review : r,
    );
    updateBookReview(newBookReview);
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
    onNavigateToEdit,
    onArchiveReview,
    onAddReview,
    onRemoveReview,
    onUpdateReview,
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
