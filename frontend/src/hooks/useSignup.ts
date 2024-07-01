import { useMutation, useQueryClient } from "@tanstack/react-query";
import authApiService from "../services/authApiService";
import { UserCredenitials, User } from "../../../shared/types/user";

export function useSignup() {
  const queryClient = useQueryClient();

  const { mutate: signup, isPending } = useMutation({
    mutationFn: async (creds: UserCredenitials) => authApiService.signup(creds),
    onSuccess: (data: User) => {
      queryClient.setQueryData(["loggedInUser"], data);
    },
  });

  return { signup, isPending };
}
