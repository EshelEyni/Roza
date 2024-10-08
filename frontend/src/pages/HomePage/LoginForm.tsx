import { FC } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { LoginCredentials } from "../../../../shared/types/user";
import { Button } from "../../components/Buttons/Button";
import { useLogin } from "../../hooks/reactQuery/update/useLogin";
import { Form } from "../../components/App/Form";
import { InputContainer } from "../../components/App/InputContainer";
import { useTranslation } from "react-i18next";
import { ReactHookFormInput } from "../../components/App/ReactHookFormInput";
import { ErrorMsg } from "../../components/Msg/ErrorMsg";
import { H1 } from "../../components/App/H1";

export const LoginForm: FC = () => {
  const { login, isPendingLogin, isErrorLogin, errorLogin } = useLogin();
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
      <H1 addedClass="text-center">{t("login")}</H1>

      <InputContainer
        label={t("username")}
        fieldError={errors.username}
        htmlFor="username"
      >
        <ReactHookFormInput<LoginCredentials>
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
        <ReactHookFormInput<LoginCredentials>
          register={register}
          name="password"
          type="password"
          required={t("formValidation.mandatory.password")}
          placeholder={t("password")}
          trigger={trigger}
        />
      </InputContainer>

      {isErrorLogin && <ErrorMsg msg={errorLogin?.message} />}

      <Button
        type="submit"
        disabled={isPendingLogin}
        addedClassName="self-center"
      >
        {isPendingLogin ? t("loggingIn") : t("login")}
      </Button>
    </Form>
  );
};
