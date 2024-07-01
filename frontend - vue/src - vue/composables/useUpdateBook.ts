import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { Book } from "../../../shared/types/books";
import bookApiService from "../services/bookApiService";

export function useUpdateBook(bookId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (newBook: Book) => bookApiService.update(newBook),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["book", bookId],
      });
    },
  });

  return mutation.mutate;
}
