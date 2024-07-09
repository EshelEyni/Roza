import { createContext, useContext, useEffect, useState } from "react";
import { UseGetBookReviewsResult, UseLoginWithTokenResult } from "../types/app";
import { useGetBookReviews } from "../hooks/reactQuery/get/useGetBookReviews";
import { useLoginWithToken } from "../hooks/reactQuery/get/useLoginWithToken";
import { BookReview } from "@rozaeyni/common-types";

type ReviewsContextType = UseLoginWithTokenResult &
  UseGetBookReviewsResult & {
    filteredReviews: BookReview[] | undefined;
    sortOrder: string;
    searchTerm: string;
    onSortReviews: (order: "asc" | "desc") => void;
    onSearchReviews: (keyword: string) => void;
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

  const {
    loggedInUser,
    isLoadingLoggedInUser,
    errorLoggedInUser,
    isSuccessLoggedInUser,
    isFetchedLoggedInUser,
    isErrorLoggedInUser,
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
    limit: 10000,
    sort: sortOrder,
    searchTerm,
  });

  function onSortReviews(order: "asc" | "desc") {
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
