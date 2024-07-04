import { useQuery } from "@tanstack/react-query";
import bookApiService from "../../../services/bookApiService";
import { UseGetBookResult } from "../../../types/app";

export function useGetBook(bookId: string | undefined): UseGetBookResult {
  const {
    data: book,
    error: errorBook,
    isLoading: isLoadingBook,
    isSuccess: isSuccessBook,
    isError: isErrorBook,
  } = useQuery({
    queryKey: ["book", bookId],
    queryFn: async () => {
      if (!bookId) return undefined;
      return bookApiService.getById(bookId);
    },
    enabled: !!bookId,
  });

  return {
    book,
    errorBook,
    isLoadingBook,
    isSuccessBook,
    isErrorBook,
  };
}
