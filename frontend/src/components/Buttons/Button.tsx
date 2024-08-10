import { FC } from "react";

type ButtonProps = {
  children: React.ReactNode;
  className?: string;
  addedClasses?: string;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
};

export const Button: FC<ButtonProps> = ({
  children,
  className = "rounded-md bg-app-500 px-4 py-1 text-white hover:bg-app-600",
  addedClasses = "",
  onClick,
  type = "button",
  disabled = false,
}) => {
  return (
    <button
      onClick={onClick}
      className={`${className} ${addedClasses}`}
      type={type}
      disabled={disabled}
    >
      {children}
    </button>
  );
};
