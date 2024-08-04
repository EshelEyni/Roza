import { FC } from "react";
import { FieldError } from "react-hook-form";
import { ErrorMsg } from "../Msg/ErrorMsg";

type InputContainerProps = {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  fieldError?: FieldError;
};

export const InputContainer: FC<InputContainerProps> = ({
  label,
  htmlFor,
  children,
  fieldError,
}) => {
  return (
    <div className="mb-4">
      <label
        className="mb-1 block cursor-pointer font-bold text-app-800"
        htmlFor={htmlFor}
      >
        {label}
      </label>
      {children}
      {fieldError && <ErrorMsg msg={fieldError.message} />}
    </div>
  );
};
