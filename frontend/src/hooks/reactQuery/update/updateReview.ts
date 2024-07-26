import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookReview } from "../../../../../shared/types/books";
import reviewsApiService from "../../../services/reviewsApiService";

export function useUpdateBookReview() {
  const queryClient = useQueryClient();
  const { mutate: updateBookReview, isPending: isPendingUpdateBookReview } =
    useMutation({
      mutationFn: async (review: BookReview) =>
        reviewsApiService.update(review),
      onSuccess: data => {
        queryClient.invalidateQueries({
          queryKey: ["bookReview", data.id],
        });
        queryClient.invalidateQueries({
          queryKey: ["reviews"],
        });
      },
    });

  return { updateBookReview, isPendingUpdateBookReview };
}
