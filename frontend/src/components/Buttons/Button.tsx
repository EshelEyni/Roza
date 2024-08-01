import { FC } from "react";

type ButtonProps = {
  children: React.ReactNode;
  className?: string;
  onClickFn?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
};

export const Button: FC<ButtonProps> = ({
  children,
  className = "rounded-md bg-app-500 px-4 py-1 text-white hover:bg-app-600",
  onClickFn,
  type = "button",
  disabled = false,
}) => {
  return (
    <button
      onClick={onClickFn}
      className={className}
      type={type}
      disabled={disabled}
    >
      {children}
    </button>
  );
};
