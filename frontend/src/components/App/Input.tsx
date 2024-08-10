import {
  UseFormRegister,
  FieldValues,
  Path,
  UseFormTrigger,
} from "react-hook-form";
import { useTranslation } from "react-i18next";

type InputProps<T extends FieldValues> = {
  register: UseFormRegister<T>;
  placeholder: string;
  name: Path<T>;
  type?: string;
  required?: boolean | string;
  trigger?: UseFormTrigger<T>;
};

export const Input = <T extends FieldValues>({
  register,
  placeholder,
  name,
  type = "text",
  trigger,
  required,
}: InputProps<T>) => {
  const { t } = useTranslation();

  function getPattern() {
    if (name === "email") {
      return {
        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i,
        message: t("invalidEmail"),
      };
    }
    return undefined;
  }

  function getMaxLength() {
    switch (name) {
      case "username":
      case "password":
      case "passwordConfirm":
      case "currentPassword":
      case "newPassword":
      case "newPasswordConfirm":
        return { value: 20, message: t(`formValidation.maxLength.${name}`) };
      case "fullname":
      case "email":
        return { value: 50, message: t(`formValidation.maxLength.${name}`) };
      default:
        return undefined;
    }
  }

  function getMinLength() {
    switch (name) {
      case "username":
      case "fullname":
      case "email":
        return { value: 3, message: t(`formValidation.minLength.${name}`) };
      case "password":
      case "passwordConfirm":
      case "currentPassword":
      case "newPassword":
      case "newPasswordConfirm":
        return { value: 8, message: t(`formValidation.minLength.${name}`) };
      default:
        return undefined;
    }
  }

  return (
    <input
      id={name}
      type={type}
      className="w-full max-w-96 rounded border border-app-300 p-2"
      {...register(name, {
        required,
        pattern: getPattern(),
        maxLength: getMaxLength(),
        minLength: getMinLength(),
      })}
      placeholder={placeholder}
      onBlur={() => required && trigger && trigger(name)}
      autoComplete="off"
    />
  );
};
