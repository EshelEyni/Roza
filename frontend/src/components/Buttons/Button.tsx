import { FC } from "react";

type ButtonProps = {
  children: React.ReactNode;
  className?: string;
  addedClassName?: string;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
};

export const Button: FC<ButtonProps> = ({
  children,
  className = "rounded-md bg-app-500 text-xl md:text-lg px-5 py-2 md:px-4 md:py-1 text-white hover:bg-app-600",
  addedClassName = "",
  onClick,
  type = "button",
  disabled = false,
}) => {
  return (
    <button
      onClick={onClick}
      className={`${className} ${addedClassName}`}
      type={type}
      disabled={disabled}
    >
      {children}
    </button>
  );
};
