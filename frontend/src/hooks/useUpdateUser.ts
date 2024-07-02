import { useMutation, useQueryClient } from "@tanstack/react-query";
import { User } from "../../../shared/types/user";
import authApiService from "../services/authApiService";

export function useUpdateUser() {
  const queryClient = useQueryClient();

  const { mutate: updateUser, isPending: isPendindUpdateUser } = useMutation({
    mutationFn: async (user: User) => authApiService.update(user),
    onSuccess: (data: User) => {
      queryClient.setQueryData(["loggedInUser"], data);
    },
  });

  return { updateUser, isPendindUpdateUser };
}
