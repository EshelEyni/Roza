import { createContext, useContext, useEffect, useState } from "react";
import { UseGetBookReviewsResult, UseLoginWithTokenResult } from "../types/app";
import { useGetBookReviews } from "../hooks/reactQuery/get/useGetBookReviews";
import { useLoginWithToken } from "../hooks/reactQuery/get/useLoginWithToken";
import { useIntersectionPagination } from "../hooks/useIntersectionPagination";
import { useUpdateUser } from "../hooks/reactQuery/update/useUpdateUser";

type BookReviewsContextType = UseLoginWithTokenResult &
  UseGetBookReviewsResult & {
    sortOrder: string;
    searchTerm: string;
    onSortReviews: (order: string) => void;
    onSearchReviews: (e: React.ChangeEvent<HTMLInputElement>) => void;
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
  const {
    loggedInUser,
    isLoadingLoggedInUser,
    errorLoggedInUser,
    isSuccessLoggedInUser,
    isErrorLoggedInUser,
    isFetchedLoggedInUser,
  } = useLoginWithToken();

  const [sortOrder, setSortOrder] = useState<string>(
    loggedInUser?.entityFilterOrder?.bookReviews || "sortOrder",
  );
  const [searchTerm, setSearchTerm] = useState<string>("");
  const { intersectionRef, paginationIdx } = useIntersectionPagination();

  const { updateUser } = useUpdateUser();

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
    if (!loggedInUser) return;
    const updatedUser = {
      ...loggedInUser,
      entityFilterOrder: {
        ...loggedInUser.entityFilterOrder,
        bookReviews: order,
      },
    };
    updateUser(updatedUser);
  }

  function onSearchReviews(e: React.ChangeEvent<HTMLInputElement>) {
    const inputValue = e.target.value;
    setSearchTerm(!inputValue ? "" : inputValue);
  }

  useEffect(() => {
    if (!loggedInUser) return;
    setSortOrder(loggedInUser.entityFilterOrder.bookReviews);
  }, [loggedInUser, sortOrder]);

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
