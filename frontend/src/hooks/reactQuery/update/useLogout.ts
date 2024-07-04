import { useMutation, useQueryClient } from "@tanstack/react-query";
import authApiService from "../../../services/authApiService";

export function useLogout() {
  const queryClient = useQueryClient();

  const { mutate: logout, isPending: isPendingLogout } = useMutation({
    mutationFn: async () => authApiService.logout(),
    onSuccess: () => {
      queryClient.setQueryData(["loggedInUser"], null);
    },
  });

  return { logout, isPendingLogout };
}
