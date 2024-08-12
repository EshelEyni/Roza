import { FC } from "react";

type H1Props = {
  children: React.ReactNode;
  className?: string;
  addedClass?: string;
  onClick?: () => void;
};

export const H1: FC<H1Props> = ({
  children,
  className = "mb-2 text-5xl font-bold text-app-800 transition duration-300 ease-in-out",
  addedClass,
  onClick,
}) => {
  return (
    <h1 className={`${className} ${addedClass}`} onClick={onClick}>
      {children}
    </h1>
  );
};
