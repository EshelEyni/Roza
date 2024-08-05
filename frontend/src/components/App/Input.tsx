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
  const isEmail = name === "email";
  return (
    <input
      id={name}
      type={type}
      className="w-full max-w-96 rounded border border-app-300 p-2"
      {...register(name, {
        required,
        pattern: isEmail
          ? {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i,
              message: t("invalidEmail"),
            }
          : undefined,
      })}
      placeholder={placeholder}
      onBlur={() => required && trigger && trigger(name)}
      autoComplete="off"
    />
  );
};
