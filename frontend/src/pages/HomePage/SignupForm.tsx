import { FC } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { UserCredenitials } from "../../../../shared/types/user";
import { Button } from "../../components/Buttons/Button";
import { useSignup } from "../../hooks/reactQuery/update/useSignup";
import { Form } from "../../components/App/Form";
import { useTranslation } from "react-i18next";
import { InputContainer } from "../../components/App/InputContainer";
import { ReactHookFormInput } from "../../components/App/ReactHookFormInput";
import { ErrorMsg } from "../../components/Msg/ErrorMsg";
import { H1 } from "../../components/App/H1";

export const SignupForm: FC = () => {
  const { signup, isPendingSignup, isErrorSignup, errorSignup } = useSignup();
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    formState: { errors },
    trigger,
  } = useForm<UserCredenitials>();

  const onSubmit: SubmitHandler<UserCredenitials> = data => {
    signup(data);
  };

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <H1 addedClass="text-center">{t("signup")}</H1>

      <InputContainer
        label={t("username")}
        fieldError={errors.username}
        htmlFor="username"
      >
        <ReactHookFormInput<UserCredenitials>
          register={register}
          name="username"
          required={t("formValidation.mandatory.username")}
          placeholder={t("username")}
          trigger={trigger}
        />
      </InputContainer>

      <InputContainer
        label={t("fullName")}
        fieldError={errors.fullname}
        htmlFor="fullname"
      >
        <ReactHookFormInput<UserCredenitials>
          register={register}
          name="fullname"
          required={t("formValidation.mandatory.fullname")}
          placeholder={t("fullName")}
          trigger={trigger}
        />
      </InputContainer>

      <InputContainer
        label={t("email")}
        fieldError={errors.email}
        htmlFor="email"
      >
        <ReactHookFormInput<UserCredenitials>
          register={register}
          name="email"
          required={t("formValidation.mandatory.email")}
          placeholder={t("email")}
          trigger={trigger}
        />
      </InputContainer>

      <InputContainer
        label={t("password")}
        fieldError={errors.password}
        htmlFor="password"
      >
        <ReactHookFormInput<UserCredenitials>
          register={register}
          name="password"
          type="password"
          required={t("formValidation.mandatory.password")}
          placeholder={t("password")}
          trigger={trigger}
        />
      </InputContainer>

      <InputContainer
        label={t("passwordConfirm")}
        fieldError={errors.passwordConfirm}
        htmlFor="passwordConfirm"
      >
        <ReactHookFormInput<UserCredenitials>
          register={register}
          name="passwordConfirm"
          type="password"
          required={t("formValidation.mandatory.passwordConfirm")}
          placeholder={t("passwordConfirm")}
          trigger={trigger}
        />
      </InputContainer>
      {isErrorSignup && <ErrorMsg msg={errorSignup?.message} />}

      <Button
        type="submit"
        disabled={isPendingSignup}
        addedClassName="self-center"
      >
        {isPendingSignup ? t("signingUp") : t("signup")}
      </Button>
    </Form>
  );
};
