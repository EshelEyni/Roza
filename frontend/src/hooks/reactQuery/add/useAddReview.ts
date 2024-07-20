import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookReview } from "../../../../../shared/types/books";
import { useNavigate } from "react-router-dom";
import reviewsApiService from "../../../services/reviewsApiService";

export function useAddBookReview() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { mutate: addBookReview, isPending: isPendingAddBookReview } =
    useMutation({
      mutationFn: async (review: BookReview) => reviewsApiService.add(review),
      onSuccess: data => {
        queryClient.invalidateQueries({
          queryKey: ["reviews"],
        });

        navigate(`/reviews/${data.id}`);
      },
    });

  return { addBookReview, isPendingAddBookReview };
}
