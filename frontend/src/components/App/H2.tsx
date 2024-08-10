import { FC } from "react";

type H2Props = {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
};

export const H2: FC<H2Props> = ({
  children,
  onClick,
  className = "text-3xl font-bold text-app-800",
}) => {
  return (
    <h2 className={className} onClick={onClick}>
      {children}
    </h2>
  );
};
