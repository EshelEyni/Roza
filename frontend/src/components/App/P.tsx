import { FC } from "react";

type PProps = {
  children: React.ReactNode;
  className?: string;
  addedClasses?: string;
};

export const P: FC<PProps> = ({
  children,
  className = "text-base text-app-800",
  addedClasses,
}) => {
  return <p className={`${className} ${addedClasses}`}>{children}</p>;
};
