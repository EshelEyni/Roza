import { FC } from "react";

type H3Props = {
  children: React.ReactNode;
  className?: string;
  addedClassName?: string;
};

export const H4: FC<H3Props> = ({
  children,
  className = "text-2xl md:text-xl font-bold text-app-800",
  addedClassName,
}) => {
  return <h4 className={`${className} ${addedClassName}`}>{children}</h4>;
};
