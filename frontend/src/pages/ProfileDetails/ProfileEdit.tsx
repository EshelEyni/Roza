import React from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { useUpdateUser } from "../../hooks/ReactQuery/update/useUpdateUser";
import { useLoginWithToken } from "../../hooks/useLoginWithToken";
import { useTranslation } from "react-i18next";
import { formatLang, getLanguages } from "../../services/utilService";
import { Button } from "../../components/Button";
import classNames from "classnames";

interface UserFormValues {
  username: string;
  fullname: string;
  email: string;
  language: string;
  roles: string[];
}

export const ProfileEdit: React.FC = () => {
  const { loggedInUser } = useLoginWithToken();
  const { updateUser, isPending } = useUpdateUser();
  const languages = getLanguages();
  const userLang = formatLang(loggedInUser?.language || "");
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<UserFormValues>({
    defaultValues: {
      username: loggedInUser?.username || "",
      fullname: loggedInUser?.fullname || "",
      email: loggedInUser?.email || "",
      language: userLang,
    },
  });

  const onSubmit: SubmitHandler<UserFormValues> = async data => {
    if (!loggedInUser) return;
    const userToUpdate = { ...loggedInUser, ...data };
    updateUser(userToUpdate);
  };

  function handleLanguageChange(language: string) {
    setValue("language", language);
  }

  if (!loggedInUser) return null;
  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mt-5 rounded-lg bg-app-200 px-6 py-4 text-app-800"
    >
      <h2 className="mb-4 text-xl font-bold text-app-700">
        {t("ProfileEdit.title")}
      </h2>

      <div className="mb-4">
        <label className="mb-1 block font-bold text-app-800">
          {t("ProfileEdit.username")}
        </label>
        <input
          className="w-full rounded border border-app-300 p-2"
          {...register("username", { required: "Username is required" })}
          placeholder={t("ProfileEdit.username")}
        />
        {errors.username && (
          <p className="text-sm text-red-500">{errors.username.message}</p>
        )}
      </div>

      <div className="mb-4">
        <label className="mb-1 block font-bold text-app-800">
          {t("ProfileEdit.fullName")}
        </label>
        <input
          className="w-full rounded border border-app-300 p-2"
          {...register("fullname", { required: "Full Name is required" })}
          placeholder={t("ProfileEdit.fullName")}
        />
        {errors.fullname && (
          <p className="text-sm text-red-500">{errors.fullname.message}</p>
        )}
      </div>

      <div className="mb-4">
        <label className="mb-1 block font-bold text-app-800">
          {t("ProfileEdit.email")}
        </label>
        <input
          type="email"
          className="w-full rounded border border-app-300 p-2"
          {...register("email", { required: "Email is required" })}
          placeholder={t("ProfileEdit.email")}
        />
        {errors.email && (
          <p className="text-sm text-red-500">{errors.email.message}</p>
        )}
      </div>
      <div className="mb-4">
        <label className="mb-1 block font-bold text-app-800">
          {t("ProfileEdit.language")}
        </label>
        <div className="flex gap-2 space-x-2">
          {languages.map(l => (
            <Button
              key={l.value}
              type="button"
              className={classNames(
                "rounded border border-app-300 bg-app-500 px-3 py-1 text-white",
                {
                  "!bg-app-600": loggedInUser?.language === l.value,
                },
              )}
              onClickFn={() => handleLanguageChange(l.value)}
            >
              {l.name}
            </Button>
          ))}
        </div>
        {errors.language && (
          <p className="text-sm text-red-500">{errors.language.message}</p>
        )}
      </div>

      <button
        type="submit"
        className="rounded bg-app-600 p-2 text-white"
        disabled={isPending}
      >
        {t("ProfileEdit.btnSubmit")}
      </button>
    </form>
  );
};
