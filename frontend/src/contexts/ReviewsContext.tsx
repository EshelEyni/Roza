import { createContext, useContext, useEffect, useState } from "react";
import { UseGetBookReviewsResult, UseLoginWithTokenResult } from "../types/app";
import { useGetBookReviews } from "../hooks/reactQuery/get/useGetBookReviews";
import { useLoginWithToken } from "../hooks/reactQuery/get/useLoginWithToken";
import { BookReview } from "../../../shared/types/books";
import { useIntersectionPagination } from "../hooks/useIntersectionPagination";

type ReviewsContextType = UseLoginWithTokenResult &
  UseGetBookReviewsResult & {
    filteredReviews: BookReview[] | undefined;
    sortOrder: string;
    searchTerm: string;
    onSortReviews: (order: "asc" | "desc") => void;
    onSearchReviews: (keyword: string) => void;
    intersectionRef: React.MutableRefObject<null>;
    paginationIdx: number;
  };

type ReviewsProviderProps = {
  children: React.ReactNode;
};

const ReviewsContext = createContext<ReviewsContextType | undefined>(undefined);

function ReviewsProvider({ children }: ReviewsProviderProps) {
  const [filteredReviews, setFilteredReviews] = useState<
    BookReview[] | undefined
  >(undefined);
  const [sortOrder, setSortOrder] = useState<string>("sortOrder");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const { intersectionRef, paginationIdx } = useIntersectionPagination();

  const {
    loggedInUser,
    isLoadingLoggedInUser,
    errorLoggedInUser,
    isSuccessLoggedInUser,
    isErrorLoggedInUser,
    isFetchedLoggedInUser,
  } = useLoginWithToken();

  const {
    reviews,
    errorReviews,
    isLoadingReviews,
    isSuccessReviews,
    isErrorReviews,
    isNoReviews,
    isReviewsAvailable,
  } = useGetBookReviews({
    enabled: !!loggedInUser,
    limit: paginationIdx * 12,
    sort: sortOrder,
    searchTerm,
  });

  function onSortReviews(order: string) {
    setSortOrder(order);
  }

  function onSearchReviews(keyword: string) {
    setSearchTerm(keyword);
  }

  const value: ReviewsContextType = {
    loggedInUser,
    isLoadingLoggedInUser,
    errorLoggedInUser,
    isSuccessLoggedInUser,
    isErrorLoggedInUser,
    isFetchedLoggedInUser,
    reviews,
    errorReviews,
    isLoadingReviews,
    isSuccessReviews,
    isErrorReviews,
    isNoReviews,
    isReviewsAvailable,
    filteredReviews,
    sortOrder,
    searchTerm,
    onSortReviews,
    onSearchReviews,
    intersectionRef,
    paginationIdx,
  };

  useEffect(() => {
    if (!reviews) return;
    setFilteredReviews(reviews);
  }, [reviews]);

  return (
    <ReviewsContext.Provider value={value}>{children}</ReviewsContext.Provider>
  );
}

const useReviews = () => {
  const context = useContext(ReviewsContext);
  if (!context)
    throw new Error("useReviews must be used within a ReviewsProvider");

  return context;
};

export { ReviewsProvider, useReviews };
