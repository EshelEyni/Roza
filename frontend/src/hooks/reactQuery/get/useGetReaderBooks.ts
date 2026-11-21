import type { ReaderLibrarySort, ReaderLibraryView } from "../../../../../shared/types/reader";
import { useInfiniteQuery } from "@tanstack/react-query";
import readerApiService from "../../../services/readerApiService";
import { useLoginWithToken } from "./useLoginWithToken";

export function useGetReaderBooks(enabled: boolean, view: ReaderLibraryView, sort: ReaderLibrarySort, search: string, resume = false) {
  const { loggedInUser } = useLoginWithToken();
  return useInfiniteQuery({
    queryKey: ["readerBooks", loggedInUser?.id, view, sort, search, resume],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => readerApiService.query(view, sort, search, pageParam, signal, resume),
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled,
    staleTime: 0,
    refetchOnMount: "always",
  });
}
