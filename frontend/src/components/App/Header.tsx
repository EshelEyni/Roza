import { FC } from "react";

type HeaderProps = {
  children: React.ReactNode;
  className?: string;
  addedClassName?: string;
};

export const Header: FC<HeaderProps> = ({
  children,
  className = "flex w-full items-center justify-between gap-4",
  addedClassName,
}) => {
  return (
    <header className={`${className} ${addedClassName}`}>{children}</header>
  );
};
