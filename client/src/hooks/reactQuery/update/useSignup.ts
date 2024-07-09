import { useMutation, useQueryClient } from "@tanstack/react-query";
import authApiService from "../../../services/authApiService";
import { UserCredenitials, User } from "@rozaeyni/common-types";

export function useSignup() {
  const queryClient = useQueryClient();

  const { mutate: signup, isPending: isPendingSignup } = useMutation({
    mutationFn: async (creds: UserCredenitials) => authApiService.signup(creds),
    onSuccess: (data: User) => {
      queryClient.setQueryData(["loggedInUser"], data);
    },
  });

  return { signup, isPendingSignup };
}
