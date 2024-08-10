import { useForm, SubmitHandler } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useUpdatePassword } from "../../hooks/reactQuery/update/useUpdatePassword";
import { InputContainer } from "../../components/App/InputContainer";
import { Input } from "../../components/App/Input";
import { H2 } from "../../components/Gen/H2";
import { Form } from "../../components/App/Form";
import { Button } from "../../components/Buttons/Button";
import { FC } from "react";
import { ErrorMsg } from "../../components/Msg/ErrorMsg";

interface PasswordFormValues {
  currentPassword: string;
  newPassword: string;
  newPasswordConfirm: string;
}

export const PasswordEdit: FC = () => {
  const {
    updatePassword,
    isPendingUpdatePassword,
    isErrorUpdatePassword,
    errorUpdatePassword,
  } = useUpdatePassword();
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    formState: { errors },
    trigger,
  } = useForm<PasswordFormValues>();

  const onSubmit: SubmitHandler<PasswordFormValues> = async data => {
    updatePassword(data);
  };

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <H2>{t("passwordEditTitle")}</H2>

      <InputContainer
        label={t("currentPassword")}
        fieldError={errors.currentPassword}
        htmlFor="currentPassword"
      >
        <Input<PasswordFormValues>
          register={register}
          name="currentPassword"
          type="password"
          required={t("formValidation.mandatory.currentPassword")}
          placeholder={t("currentPassword")}
          trigger={trigger}
        />
      </InputContainer>

      <InputContainer
        label={t("newPassword")}
        fieldError={errors.newPassword}
        htmlFor="newPassword"
      >
        <Input<PasswordFormValues>
          register={register}
          name="newPassword"
          type="password"
          required={t("formValidation.mandatory.newPassword")}
          placeholder={t("newPassword")}
          trigger={trigger}
        />
      </InputContainer>

      <InputContainer
        label={t("newPasswordConfirm")}
        fieldError={errors.newPasswordConfirm}
        htmlFor="newPasswordConfirm"
      >
        <Input<PasswordFormValues>
          register={register}
          name="newPasswordConfirm"
          type="password"
          required={t("formValidation.mandatory.newPasswordConfirm")}
          placeholder={t("newPasswordConfirm")}
          trigger={trigger}
        />
      </InputContainer>
      {isErrorUpdatePassword && <ErrorMsg msg={errorUpdatePassword?.message} />}
      <Button
        type="submit"
        disabled={isPendingUpdatePassword}
        addedClasses="self-center"
      >
        {t("btnSubmit")}
      </Button>
    </Form>
  );
};
