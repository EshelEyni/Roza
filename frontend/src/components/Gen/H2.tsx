import { FC } from "react";

type H2Props = {
  children: React.ReactNode;
  className?: string;
};

export const H2: FC<H2Props> = ({
  children,
  className = "mb-2 text-2xl font-bold text-app-800",
}) => {
  return <h2 className={className}>{children}</h2>;
};
