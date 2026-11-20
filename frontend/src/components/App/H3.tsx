import { FC } from "react";

type H3Props = {
  children: React.ReactNode;
  className?: string;
  addedClassName?: string;
};

export const H3: FC<H3Props> = ({
  children,
  className = "ui-h3",
  addedClassName,
}) => {
  return <h3 className={`${className} ${addedClassName ?? ""}`}>{children}</h3>;
};
