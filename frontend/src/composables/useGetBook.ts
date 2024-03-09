import { useQuery } from "@tanstack/vue-query";
import bookApiService from "../services/bookApiService";
import { Book } from "../../../shared/types/books";

export function useGetBook(bookId: string, callback?: Function) {
  const {
    data: book,
    isError,
    isLoading,
  } = useQuery({
    queryKey: ["book", bookId],
    queryFn: async () => {
      const res = await bookApiService.getById(bookId);
      const book = res.data as Book;
      callback?.(book);
      return book;
    },
    enabled: !!bookId,
  });

  return { book, isError, isLoading };
}
