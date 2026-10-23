import { useQuery } from "@tanstack/react-query";
import readerApiService from "../../../services/readerApiService";
import { useLoginWithToken } from "./useLoginWithToken";

export function useGetReaderAccess() {
  const { loggedInUser } = useLoginWithToken();
  return useQuery({
    queryKey: ["readerAccess", loggedInUser?.id],
    queryFn: readerApiService.getAccess,
    enabled: !!loggedInUser,
    retry: false,
    staleTime: 60_000,
  });
}
