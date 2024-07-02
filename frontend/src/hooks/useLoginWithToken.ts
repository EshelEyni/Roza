import { useQuery } from "@tanstack/react-query";
import { User } from "../../../shared/types/user";
import authApiService from "../services/authApiService";

type UseLoginWithToken = {
  loggedInUser: User | null | undefined;
  errorLoggedInUser: unknown;
  isLoadingLoggedInUser: boolean;
  isSuccessLoggedInUser: boolean;
  isErrorLoggedInUser: boolean;
};

export function useLoginWithToken(): UseLoginWithToken {
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
