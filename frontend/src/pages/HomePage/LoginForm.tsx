import { FC } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { LoginCredentials } from "../../../../shared/types/user";
import { Button } from "../../components/Buttons/Button";
import { useLogin } from "../../hooks/reactQuery/update/useLogin";
import { Form } from "../../components/App/Form";
import { H2 } from "../../components/Gen/H2";
import { InputContainer } from "../../components/App/InputContainer";
import { useTranslation } from "react-i18next";
import { Input } from "../../components/App/Input";

export const LoginForm: FC = () => {
  const { login, isPendingLogin } = useLogin();
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
    trigger,
  } = useForm<LoginCredentials>();

  const onSubmit: SubmitHandler<LoginCredentials> = data => {
    login(data);
  };

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <H2>{t("login")}</H2>

      <InputContainer
        label={t("username")}
        fieldError={errors.username}
        htmlFor="username"
      >
        <Input<LoginCredentials>
          register={register}
          name="username"
          required={t("formValidation.mandatory.username")}
          placeholder={t("username")}
          trigger={trigger}
        />
      </InputContainer>

      <InputContainer
        label={t("password")}
        fieldError={errors.password}
        htmlFor="password"
      >
        <Input<LoginCredentials>
          register={register}
          name="password"
          type="password"
          required={t("formValidation.mandatory.password")}
          placeholder={t("password")}
          trigger={trigger}
        />
      </InputContainer>

      <Button
        type="submit"
        disabled={isPendingLogin}
        addedClasses="self-center"
      >
        {isPendingLogin ? t("loggingIn") : t("login")}
      </Button>
    </Form>
  );
};
