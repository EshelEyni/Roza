import { useQuery } from "@tanstack/react-query";
import { User } from "../../../shared/types/user";
import authApiService from "../services/authApiService";

type UseLoginWithToken = {
  loggedInUser: User | null | undefined;
  error: unknown;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
};

export function useLoginWithToken(): UseLoginWithToken {
  const {
    data: loggedInUser,
    error,
    isLoading,
    isSuccess,
    isError,
  } = useQuery({
    queryKey: ["loggedInUser"],
    queryFn: authApiService.loginWithToken,
    retry: 0,
  });

  return { loggedInUser, error, isLoading, isSuccess, isError };
}
