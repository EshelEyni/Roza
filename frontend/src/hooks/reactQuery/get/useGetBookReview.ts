import { useQuery } from "@tanstack/react-query";
import { UseGetBookReviewResult } from "../../../types/app";
import bookReviewApiService from "../../../services/bookReviewApiService";

export function useGetBookReview(
  id: string | undefined,
): UseGetBookReviewResult {
  const {
    data: bookReview,
    error: errorBookReview,
    isLoading: isLoadingBookReview,
    isSuccess: isSuccessBookReview,
    isError: isErrorBookReview,
  } = useQuery({
    queryKey: ["bookReview", id],
    queryFn: async () => {
      if (!id) return undefined;
      return bookReviewApiService.getById(id);
    },
    enabled: !!id,
  });

  return {
    bookReview,
    errorBookReview,
    isLoadingBookReview,
    isSuccessBookReview,
    isErrorBookReview,
  };
}
