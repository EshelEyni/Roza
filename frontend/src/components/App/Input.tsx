import { FC } from "react";

type InputProps = {
  type: string;
  defaultValue: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  name?: string;
  className?: string;
  autoFocus?: boolean;
};

export const Input: FC<InputProps> = ({
  type,
  defaultValue,
  onChange,
  placeholder,
  name,
  className = "ui-input ui-input-title",
  autoFocus,
}) => {
  return (
    <input
      type={type}
      onChange={onChange}
      defaultValue={defaultValue}
      placeholder={placeholder}
      name={name}
      className={className}
      autoFocus={autoFocus}
      autoComplete="off"
    />
  );
};
