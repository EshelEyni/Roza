import { FC } from "react";

type HeaderProps = {
  children: React.ReactNode;
  className?: string;
};

export const Header: FC<HeaderProps> = ({
  children,
  className = "flex w-full items-center justify-between gap-4",
}) => {
  return <header className={className}>{children}</header>;
};
