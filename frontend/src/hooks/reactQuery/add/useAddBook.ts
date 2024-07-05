import { useMutation, useQueryClient } from "@tanstack/react-query";
import bookApiService from "../../../services/bookApiService";
import { Book } from "../../../../../shared/types/books";
import { useNavigate } from "react-router-dom";

export function useAddBook() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { mutate: addBook, isPending: isPendingAddBook } = useMutation({
    mutationFn: async (book: Book) => bookApiService.add(book),
    onSuccess: data => {
      queryClient.invalidateQueries({
        queryKey: ["books"],
      });

      navigate(`/book/${data.id}`);
    },
  });

  return { addBook, isPendingAddBook };
}
