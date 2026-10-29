import { useQuery } from "@tanstack/react-query";
import readerApiService from "../../../services/readerApiService";
import { useLoginWithToken } from "./useLoginWithToken";

export function useGetReaderBooks(enabled: boolean, archived = false) {
  const { loggedInUser } = useLoginWithToken();
  return useQuery({
    queryKey: ["readerBooks", loggedInUser?.id, archived],
    queryFn: () => readerApiService.query(archived),
    enabled,
    staleTime: 0,
    refetchOnMount: "always",
  });
}
