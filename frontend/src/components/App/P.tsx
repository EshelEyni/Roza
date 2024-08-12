import { FC } from "react";

type PProps = {
  children: React.ReactNode;
  className?: string;
  addedClassName?: string;
};

export const P: FC<PProps> = ({
  children,
  className = "text-xl text-app-800",
  addedClassName,
}) => {
  return <p className={`${className} ${addedClassName}`}>{children}</p>;
};
