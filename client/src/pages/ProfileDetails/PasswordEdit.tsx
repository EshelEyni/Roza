import React from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useUpdatePassword } from "../../hooks/reactQuery/update/useUpdatePassword";

interface PasswordFormValues {
  currentPassword: string;
  newPassword: string;
  newPasswordConfirm: string;
}

export const PasswordEdit: React.FC = () => {
  const { updatePassword, isPendingUpdatePassword } = useUpdatePassword();
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PasswordFormValues>();

  const onSubmit: SubmitHandler<PasswordFormValues> = async data => {
    updatePassword(data);
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mt-5 rounded-lg bg-app-200 px-6 py-4 text-app-800"
    >
      <h2 className="mb-4 text-xl font-bold text-app-700">
        {t("PasswordEdit.title")}
      </h2>

      <div className="mb-4">
        <label className="mb-1 block font-bold text-app-800">
          {t("PasswordEdit.currentPassword")}
        </label>
        <input
          type="password"
          className="w-full rounded border border-app-300 p-2"
          {...register("currentPassword", {
            required: "Current password is required",
          })}
          placeholder={t("PasswordEdit.currentPassword")}
        />
        {errors.currentPassword && (
          <p className="text-sm text-red-500">
            {errors.currentPassword.message}
          </p>
        )}
      </div>

      <div className="mb-4">
        <label className="mb-1 block font-bold text-app-800">
          {t("PasswordEdit.newPassword")}
        </label>
        <input
          type="password"
          className="w-full rounded border border-app-300 p-2"
          {...register("newPassword", { required: "New password is required" })}
          placeholder={t("PasswordEdit.newPassword")}
        />
        {errors.newPassword && (
          <p className="text-sm text-red-500">{errors.newPassword.message}</p>
        )}
      </div>

      <div className="mb-4">
        <label className="mb-1 block font-bold text-app-800">
          {t("PasswordEdit.newPasswordConfirm")}
        </label>
        <input
          type="password"
          className="w-full rounded border border-app-300 p-2"
          {...register("newPasswordConfirm", {
            required: "Password confirmation is required",
          })}
          placeholder={t("PasswordEdit.newPasswordConfirm")}
        />
        {errors.newPasswordConfirm && (
          <p className="text-sm text-red-500">
            {errors.newPasswordConfirm.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        className="rounded bg-app-600 p-2 text-white"
        disabled={isPendingUpdatePassword}
      >
        {t("PasswordEdit.btnSubmit")}
      </button>
    </form>
  );
};
