import { FC } from "react";

type H2Props = {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  addedClassName?: string;
};

export const H2: FC<H2Props> = ({
  children,
  onClick,
  className = "text-4xl md:text-3xl font-bold text-app-800",
  addedClassName = "",
}) => {
  return (
    <h2 className={`${className} ${addedClassName}`} onClick={onClick}>
      {children}
    </h2>
  );
};
