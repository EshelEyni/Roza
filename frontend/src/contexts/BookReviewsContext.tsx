import { createContext, useContext, useState } from "react";
import { UseGetBookReviewsResult, UseLoginWithTokenResult } from "../types/app";
import { useGetBookReviews } from "../hooks/reactQuery/get/useGetBookReviews";
import { useLoginWithToken } from "../hooks/reactQuery/get/useLoginWithToken";
import { useIntersectionPagination } from "../hooks/useIntersectionPagination";

type BookReviewsContextType = UseLoginWithTokenResult &
  UseGetBookReviewsResult & {
    sortOrder: string;
    searchTerm: string;
    onSortReviews: (order: "asc" | "desc") => void;
    onSearchReviews: (keyword: string) => void;
    intersectionRef: React.MutableRefObject<null>;
    paginationIdx: number;
  };

type BookReviewsProviderProps = {
  children: React.ReactNode;
};

const BookReviewsContext = createContext<BookReviewsContextType | undefined>(
  undefined,
);

function BookReviewsProvider({ children }: BookReviewsProviderProps) {
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

  const value: BookReviewsContextType = {
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
    sortOrder,
    searchTerm,
    onSortReviews,
    onSearchReviews,
    intersectionRef,
    paginationIdx,
  };

  return (
    <BookReviewsContext.Provider value={value}>
      {children}
    </BookReviewsContext.Provider>
  );
}

const useBookReviews = () => {
  const context = useContext(BookReviewsContext);
  if (!context)
    throw new Error("useReviews must be used within a BookReviewsProvider");

  return context;
};

export { BookReviewsProvider, useBookReviews };
