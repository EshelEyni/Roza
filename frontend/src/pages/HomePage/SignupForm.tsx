import { FC } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { UserCredenitials } from "../../../../shared/types/user";
import { Button } from "../../components/Buttons/Button";
import { useSignup } from "../../hooks/reactQuery/update/useSignup";
import { Form } from "../../components/App/Form";
import { useTranslation } from "react-i18next";
import { H2 } from "../../components/Gen/H2";
import { InputContainer } from "../../components/App/InputContainer";
import { Input } from "../../components/App/Input";
import { ErrorMsg } from "../../components/Msg/ErrorMsg";

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
      <H2>{t("signup")}</H2>

      <InputContainer
        label={t("username")}
        fieldError={errors.username}
        htmlFor="username"
      >
        <Input<UserCredenitials>
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
        <Input<UserCredenitials>
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
        <Input<UserCredenitials>
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
        <Input<UserCredenitials>
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
        <Input<UserCredenitials>
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
        addedClasses="self-center"
      >
        {isPendingSignup ? t("signingUp") : t("signup")}
      </Button>
    </Form>
  );
};
