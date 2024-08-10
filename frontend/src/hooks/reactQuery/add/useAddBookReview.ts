import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookReview } from "../../../../../shared/types/books";
import { useNavigate } from "react-router-dom";
import bookReviewApiService from "../../../services/bookReviewApiService";

export function useAddBookReview() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { mutate: addBookReview, isPending: isPendingAddBookReview } =
    useMutation({
      mutationFn: async (review: BookReview) =>
        bookReviewApiService.add(review),
      onSuccess: data => {
        queryClient.invalidateQueries({
          queryKey: ["reviews"],
        });

        navigate(`/review/${data.id}`);
      },
    });

  return { addBookReview, isPendingAddBookReview };
}
