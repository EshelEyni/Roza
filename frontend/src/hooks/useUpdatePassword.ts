import { useMutation, useQueryClient } from "@tanstack/react-query";
import authApiService from "../services/authApiService";
import { UpdatePasswordParams } from "../types/app";

export function useUpdatePassword() {
  const queryClient = useQueryClient();

  const { mutate: updatePassword, isPending: isPendingUpdatePassword } =
    useMutation({
      mutationFn: async ({
        currentPassword,
        newPassword,
        newPasswordConfirm,
      }: UpdatePasswordParams) =>
        authApiService.updatePassword({
          currentPassword,
          newPassword,
          newPasswordConfirm,
        }),
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["loggedInUser"],
        });
      },
    });

  return { updatePassword, isPendingUpdatePassword };
}
