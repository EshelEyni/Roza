import { useQuery } from "@tanstack/react-query";
import authApiService from "../../../services/authApiService";
import { UseLoginWithTokenResult } from "../../../types/app";

export function useLoginWithToken(): UseLoginWithTokenResult {
  const {
    data: loggedInUser,
    error: errorLoggedInUser,
    isLoading: isLoadingLoggedInUser,
    isSuccess: isSuccessLoggedInUser,
    isError: isErrorLoggedInUser,
  } = useQuery({
    queryKey: ["loggedInUser"],
    queryFn: authApiService.loginWithToken,
    retry: 0,
  });

  return {
    loggedInUser,
    errorLoggedInUser,
    isLoadingLoggedInUser,
    isSuccessLoggedInUser,
    isErrorLoggedInUser,
  };
}
