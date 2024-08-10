import { FC } from "react";

type H3Props = {
  children: React.ReactNode;
  className?: string;
  addedClasses?: string;
};

export const H3: FC<H3Props> = ({
  children,
  className = "text-2xl font-bold text-app-800",
  addedClasses,
}) => {
  return <h3 className={`${className} ${addedClasses}`}>{children}</h3>;
};
