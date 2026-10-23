import { useQuery } from "@tanstack/react-query";
import readerApiService from "../../../services/readerApiService";
import { useLoginWithToken } from "./useLoginWithToken";

export function useGetReaderBooks(enabled: boolean) {
  const { loggedInUser } = useLoginWithToken();
  return useQuery({
    queryKey: ["readerBooks", loggedInUser?.id],
    queryFn: readerApiService.query,
    enabled,
    staleTime: 0,
    refetchOnMount: "always",
  });
}
