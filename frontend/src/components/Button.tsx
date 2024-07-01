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
  className,
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
