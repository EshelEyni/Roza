import { useQuery } from "@tanstack/react-query";
import { Book } from "../../../shared/types/books";
import bookApiService from "../services/bookApiService";

type UseGetBooksResult = {
  books: Book[] | undefined;
  error: unknown;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
};

type UseGetBooksParams = {
  userId: string;
};

export function useGetBooks({ userId }: UseGetBooksParams): UseGetBooksResult {
  const {
    data: books,
    error,
    isLoading,
    isSuccess,
    isError,
  } = useQuery({
    queryKey: ["books", userId],
    queryFn: async () => {
      return bookApiService.query(userId);
    },
    enabled: !!userId,
  });

  return { books, error, isLoading, isSuccess, isError };
}
