import { useQuery } from "@tanstack/react-query";
import { BookReview } from "../../../shared/types/books";
import reviewsApiService from "../services/reviewsApiService";

type UseGetBookReviewsResult = {
  reviews: BookReview[] | undefined;
  errorReviews: unknown;
  isLoadingReviews: boolean;
  isSuccessReviews: boolean;
  isErrorReviews: boolean;
};

type UseGetBookReviewsParams = {
  userId: string;
};

export function useGetBookReviews({
  userId,
}: UseGetBookReviewsParams): UseGetBookReviewsResult {
  const {
    data: reviews,
    error: errorReviews,
    isLoading: isLoadingReviews,
    isSuccess: isSuccessReviews,
    isError: isErrorReviews,
  } = useQuery({
    queryKey: ["reviews", userId],
    queryFn: async () => {
      return reviewsApiService.query(userId);
    },
    enabled: !!userId,
  });

  return {
    reviews,
    errorReviews,
    isLoadingReviews,
    isSuccessReviews,
    isErrorReviews,
  };
}
