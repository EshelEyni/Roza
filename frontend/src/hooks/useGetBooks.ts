import { useQuery } from "@tanstack/react-query";
import bookApiService from "../services/bookApiService";
import { UseGetBooksResult } from "../types/app";

type UseGetBooksParams = {
  userId: string;
};

export function useGetBooks({ userId }: UseGetBooksParams): UseGetBooksResult {
  const {
    data: books,
    error: errorBooks,
    isLoading: isLoadingBooks,
    isSuccess: isSuccessBooks,
    isError: isErrorBooks,
  } = useQuery({
    queryKey: ["books", userId],
    queryFn: async () => {
      return bookApiService.query(userId);
    },
    enabled: !!userId,
  });

  const isEmpty = isSuccessBooks && !!books && books.length === 0;
  const isBooksAvailable = isSuccessBooks && !!books && books.length > 0;

  return {
    books,
    errorBooks,
    isLoadingBooks,
    isSuccessBooks,
    isErrorBooks,
    isEmpty,
    isBooksAvailable,
  };
}
