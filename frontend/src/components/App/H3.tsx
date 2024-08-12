import { FC } from "react";

type H3Props = {
  children: React.ReactNode;
  className?: string;
  addedClassName?: string;
};

export const H3: FC<H3Props> = ({
  children,
  className = "text-3xl md:text-2xl font-bold text-app-800",
  addedClassName,
}) => {
  return <h3 className={`${className} ${addedClassName}`}>{children}</h3>;
};
