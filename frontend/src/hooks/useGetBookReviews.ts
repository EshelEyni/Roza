import { useQuery } from "@tanstack/react-query";
import reviewsApiService from "../services/reviewsApiService";
import { UseGetBookReviewsResult } from "../types/app";

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

  const isNoReviews = isSuccessReviews && !!reviews && reviews.length === 0;
  const isReviewsAvailable =
    isSuccessReviews && !!reviews && reviews.length > 0;

  return {
    reviews,
    errorReviews,
    isLoadingReviews,
    isSuccessReviews,
    isErrorReviews,
    isNoReviews,
    isReviewsAvailable,
  };
}
