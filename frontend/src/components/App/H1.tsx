import { FC } from "react";

type H1Props = {
  children: React.ReactNode;
  className?: string;
  addedClass?: string;
  onClick?: () => void;
};

export const H1: FC<H1Props> = ({
  children,
  className = "ui-h1",
  addedClass,
  onClick,
}) => {
  return (
    <h1 className={`${className} ${addedClass ?? ""}`} onClick={onClick}>
      {children}
    </h1>
  );
};
