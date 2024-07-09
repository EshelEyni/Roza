import { useMutation, useQueryClient } from "@tanstack/react-query";
import authApiService from "../../../services/authApiService";
import { LoginCredentials, User } from "@rozaeyni/common-types";

export function useLogin() {
  const queryClient = useQueryClient();

  const { mutate: login, isPending: isPendingLogin } = useMutation({
    mutationFn: async (creds: LoginCredentials) =>
      authApiService.login(creds.username, creds.password),
    onSuccess: (data: User) => {
      queryClient.setQueryData(["loggedInUser"], data);
    },
  });

  return { login, isPendingLogin };
}
