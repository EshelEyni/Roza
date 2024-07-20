import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookReview } from "../../../../../shared/types/books";
import { useNavigate } from "react-router-dom";
import reviewsApiService from "../../../services/reviewsApiService";

export function useUpdateBookReview() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { mutate: updateBookReview, isPending: isPendingUpdateBookReview } =
    useMutation({
      mutationFn: async (review: BookReview) =>
        reviewsApiService.update(review),
      onSuccess: data => {
        queryClient.invalidateQueries({
          queryKey: ["review", data.id],
        });
        queryClient.invalidateQueries({
          queryKey: ["reviews"],
        });
        navigate(`/review-edit/${data.id}`);
      },
    });

  return { updateBookReview, isPendingUpdateBookReview };
}
