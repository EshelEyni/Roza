import { createContext, useContext, useEffect, useState } from "react";
import { UseGetBookReviewsResult, UseLoginWithTokenResult } from "../types/app";
import { useGetBookReviews } from "../hooks/useGetBookReviews";
import { useLoginWithToken } from "../hooks/useLoginWithToken";
import { BookReview } from "../../../shared/types/books";

type ReviewsContextType = UseLoginWithTokenResult &
  UseGetBookReviewsResult & {
    filteredReviews: BookReview[] | undefined;
    sortOrder: "asc" | "desc";
    searchKeyword: string;
    onSortReviews: (order: "asc" | "desc") => BookReview[] | undefined;
    onSearchReviews: (keyword: string) => BookReview[] | undefined;
  };

type ReviewsProviderProps = {
  children: React.ReactNode;
};

const ReviewsContext = createContext<ReviewsContextType | undefined>(undefined);

function ReviewsProvider({ children }: ReviewsProviderProps) {
  const [filteredReviews, setFilteredReviews] = useState<
    BookReview[] | undefined
  >(undefined);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [searchKeyword, setSearchKeyword] = useState<string>("");

  const {
    loggedInUser,
    isLoadingLoggedInUser,
    errorLoggedInUser,
    isSuccessLoggedInUser,
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
  } = useGetBookReviews({ userId: loggedInUser?.id || "" });

  function sortReviews(order: "asc" | "desc"): BookReview[] | undefined {
    if (!reviews) return;
    const sortedReviews = reviews.sort((a, b) => {
      if (order === "asc") return a.sortOrder - b.sortOrder;
      return b.sortOrder - a.sortOrder;
    });

    setFilteredReviews(sortedReviews);
  }

  function searchReviews(keyword: string): BookReview[] | undefined {
    if (!reviews) return;
    const lowerKeyword = keyword.toLowerCase();
    const searchedReviews = reviews.filter(r => {
      const nameMatch = r.name.toLowerCase().includes(lowerKeyword);
      const reviewsMatch = r.reviews.some(review =>
        review.text.toLowerCase().includes(lowerKeyword),
      );
      return nameMatch || reviewsMatch;
    });

    setFilteredReviews(searchedReviews);
  }

  function onSortReviews(order: "asc" | "desc") {
    setSortOrder(order);
    return sortReviews(order);
  }

  function onSearchReviews(keyword: string) {
    setSearchKeyword(keyword);
    return searchReviews(keyword);
  }

  const value: ReviewsContextType = {
    loggedInUser,
    isLoadingLoggedInUser,
    errorLoggedInUser,
    isSuccessLoggedInUser,
    isErrorLoggedInUser,
    reviews,
    errorReviews,
    isLoadingReviews,
    isSuccessReviews,
    isErrorReviews,
    isNoReviews,
    isReviewsAvailable,
    filteredReviews,
    sortOrder,
    searchKeyword,
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
