import { useMutation, useQueryClient } from "@tanstack/react-query";
import bookApiService from "../../../services/bookApiService";
import { Book } from "../../../../../shared/types/books";

export function useUpdateBook() {
  const queryClient = useQueryClient();

  const { mutate: updateBook, isPending: isPendingUpdateBook } = useMutation({
    mutationFn: async (book: Book) => bookApiService.update(book),
    onSuccess: data => {
      queryClient.invalidateQueries({
        queryKey: ["book", data.id],
      });
    },
  });

  return { updateBook, isPendingUpdateBook };
}
