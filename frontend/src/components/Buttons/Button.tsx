import { FC } from "react";

type ButtonProps = {
  children: React.ReactNode;
  className?: string;
  addedClassName?: string;
  isSmall?: boolean;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
};

export const Button: FC<ButtonProps> = ({
  children,
  className = "rounded-md bg-app-500 text-xl md:text-lg px-5 py-2 md:px-4 md:py-1 text-white hover:bg-app-600",
  addedClassName = "",
  isSmall = false,
  onClick,
  type = "button",
  disabled = false,
}) => {
  if (isSmall)
    className = `${className} !text-lg !px-3 !py-1 md:!px-3 md:!py-0`;
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
