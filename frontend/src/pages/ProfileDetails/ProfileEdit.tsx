import React from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { useUpdateUser } from "../../hooks/reactQuery/update/useUpdateUser";
import { useLoginWithToken } from "../../hooks/reactQuery/get/useLoginWithToken";
import { useTranslation } from "react-i18next";
import { getLanguages } from "../../services/utilService";
import { Button } from "../../components/Buttons/Button";
import classNames from "classnames";
import { Hr } from "../../components/Gen/Hr";
import { H2 } from "../../components/Gen/H2";
import { InputContainer } from "../../components/App/InputContainer";
import { Input } from "../../components/App/Input";
import { Form } from "../../components/App/Form";
import { ErrorMsg } from "../../components/Msg/ErrorMsg";

interface UserFormValues {
  username: string;
  fullname: string;
  email: string;
  language: string;
  roles: string[];
}

export const ProfileEdit: React.FC = () => {
  const { loggedInUser } = useLoginWithToken();
  const {
    updateUser,
    isPendindUpdateUser,
    isErrorUpdateUser,
    errorUpdateUser,
  } = useUpdateUser();
  const languages = getLanguages();
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    trigger,
  } = useForm<UserFormValues>({
    defaultValues: {
      username: loggedInUser?.username || "",
      fullname: loggedInUser?.fullname || "",
      email: loggedInUser?.email || "",
      language: loggedInUser?.language || "",
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

  const selectedLanguage = watch("language");

  if (!loggedInUser) return null;
  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <H2>{t("ProfileEdit.title")}</H2>

      <InputContainer
        label={t("ProfileEdit.username")}
        fieldError={errors.username}
        htmlFor="username"
      >
        <Input<UserFormValues>
          register={register}
          name="username"
          required={t("formValidation.mandatory.username")}
          placeholder={t("ProfileEdit.username")}
          trigger={trigger}
        />
      </InputContainer>

      <InputContainer
        label={t("ProfileEdit.fullName")}
        fieldError={errors.fullname}
        htmlFor="fullname"
      >
        <Input<UserFormValues>
          register={register}
          name="fullname"
          required={t("formValidation.mandatory.fullname")}
          placeholder={t("ProfileEdit.fullname")}
          trigger={trigger}
        />
      </InputContainer>

      <InputContainer
        label={t("ProfileEdit.email")}
        fieldError={errors.email}
        htmlFor="email"
      >
        <Input<UserFormValues>
          register={register}
          name="email"
          type="email"
          required={t("formValidation.mandatory.email")}
          placeholder={t("ProfileEdit.email")}
          trigger={trigger}
        />
      </InputContainer>
      <InputContainer
        label={t("ProfileEdit.language")}
        fieldError={errors.language}
      >
        <div className="flex gap-2 space-x-2">
          {languages.map(l => (
            <Button
              key={l.value}
              type="button"
              className={classNames(
                "rounded-md bg-app-500 px-4 py-1 text-white hover:bg-app-600",
                {
                  "!bg-app-600": selectedLanguage === l.value,
                },
              )}
              onClickFn={() => handleLanguageChange(l.value)}
            >
              {l.name}
            </Button>
          ))}
        </div>
      </InputContainer>
      {isErrorUpdateUser && <ErrorMsg msg={errorUpdateUser?.message} />}
      <Hr />
      <Button
        type="submit"
        disabled={isPendindUpdateUser}
        addedClasses="self-center"
      >
        {t("ProfileEdit.btnSubmit")}
      </Button>
    </Form>
  );
};
