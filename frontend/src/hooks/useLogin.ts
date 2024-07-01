import { useMutation, useQueryClient } from "@tanstack/react-query";
import authApiService from "../services/authApiService";
import { LoginCredentials, User } from "../../../shared/types/user";

export function useLogin() {
  const queryClient = useQueryClient();

  const { mutate: login, isPending } = useMutation({
    mutationFn: async (creds: LoginCredentials) =>
      authApiService.login(creds.username, creds.password),
    onSuccess: (data: User) => {
      queryClient.setQueryData(["loggedInUser"], data);
    },
  });

  return { login, isPending };
}
