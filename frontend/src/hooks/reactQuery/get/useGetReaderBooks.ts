import { useInfiniteQuery } from "@tanstack/react-query";
import readerApiService from "../../../services/readerApiService";
import { useLoginWithToken } from "./useLoginWithToken";

export function useGetReaderBooks(enabled: boolean, archived = false) {
  const { loggedInUser } = useLoginWithToken();
  return useInfiniteQuery({
    queryKey: ["readerBooks", loggedInUser?.id, archived],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => readerApiService.query(archived, pageParam, signal),
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled,
    staleTime: 0,
    refetchOnMount: "always",
  });
}
