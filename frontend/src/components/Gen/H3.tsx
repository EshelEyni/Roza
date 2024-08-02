import { FC } from "react";

type H3Props = {
  children: React.ReactNode;
  className?: string;
};

export const H3: FC<H3Props> = ({
  children,
  className = "mb-2 text-2xl font-bold text-app-800",
}) => {
  return <h3 className={className}>{children}</h3>;
};
