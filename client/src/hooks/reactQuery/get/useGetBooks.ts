import { useQuery } from "@tanstack/react-query";
import bookApiService from "../../../services/bookApiService";
import { BookQueryParams, UseGetBooksResult } from "../../../types/app";

type useGetBooksParams = BookQueryParams & {
  enabled?: boolean;
};

export function useGetBooks({
  enabled = true,
  limit,
  sort,
  searchTerm,
}: useGetBooksParams): UseGetBooksResult {
  const {
    data: books,
    error: errorBooks,
    isLoading: isLoadingBooks,
    isSuccess: isSuccessBooks,
    isError: isErrorBooks,
  } = useQuery({
    queryKey: ["books", limit, sort, searchTerm],
    queryFn: async () => {
      return bookApiService.query({ limit, sort, searchTerm });
    },
    enabled,
  });

  const isNoBooks = isSuccessBooks && !!books && books.length === 0;
  const isBooksAvailable = isSuccessBooks && !!books && books.length > 0;

  return {
    books,
    errorBooks,
    isLoadingBooks,
    isSuccessBooks,
    isErrorBooks,
    isNoBooks,
    isBooksAvailable,
  };
}
