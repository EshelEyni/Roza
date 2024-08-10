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
  className = "w-full rounded-md border border-app-900 bg-gray-50 px-4 py-2 text-3xl font-bold text-app-700",
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
