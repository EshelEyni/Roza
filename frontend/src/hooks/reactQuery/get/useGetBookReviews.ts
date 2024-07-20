import { useQuery } from "@tanstack/react-query";
import reviewsApiService from "../../../services/reviewsApiService";
import { ReviewQueryParams, UseGetBookReviewsResult } from "../../../types/app";

type useGetBookReviewsParams = ReviewQueryParams & {
  enabled?: boolean;
};

export function useGetBookReviews({
  enabled = true,
  limit,
  sort,
  searchTerm,
}: useGetBookReviewsParams): UseGetBookReviewsResult {
  const {
    data: reviews,
    error: errorReviews,
    isLoading: isLoadingReviews,
    isSuccess: isSuccessReviews,
    isError: isErrorReviews,
  } = useQuery({
    queryKey: ["reviews", limit, sort, searchTerm],
    queryFn: async () => {
      return reviewsApiService.query({ limit, sort, searchTerm });
    },
    enabled,
  });

  const isNoReviews = isSuccessReviews && !!reviews && reviews.length === 0;
  const isReviewsAvailable = !!reviews && reviews.length > 0;

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
