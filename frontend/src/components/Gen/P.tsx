import { FC } from "react";

type PProps = {
  children: React.ReactNode;
  className?: string;
};

export const P: FC<PProps> = ({
  children,
  className = "text-base text-app-800",
}) => {
  return <p className={className}>{children}</p>;
};
