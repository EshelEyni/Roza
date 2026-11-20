import { FC } from "react";
import { buttonClassName, ButtonVariant } from "./buttonClassName";

type ButtonProps = {
  children: React.ReactNode;
  className?: string;
  addedClassName?: string;
  isSmall?: boolean;
  variant?: ButtonVariant;
  isActive?: boolean;
  ariaLabel?: string;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
};

export const Button: FC<ButtonProps> = ({
  children,
  className,
  addedClassName = "",
  isSmall = false,
  variant = "secondary",
  isActive = false,
  ariaLabel,
  onClick,
  type = "button",
  disabled = false,
}) => {
  const classes = [
    className ?? buttonClassName(variant, isSmall),
    isActive && "is-active",
    addedClassName,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      onClick={onClick}
      className={classes}
      type={type}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={isActive || undefined}
    >
      {children}
    </button>
  );
};
