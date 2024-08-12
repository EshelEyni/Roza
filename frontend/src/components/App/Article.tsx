import { FC } from "react";

type ArticleProps = {
  children: React.ReactNode;
  className?: string;
  addedClassName?: string;
  onClick?: () => void;
};

export const Article: FC<ArticleProps> = ({
  children,
  className = "h-full cursor-pointer rounded-lg border border-app-800 bg-app-100 p-2 shadow-lg transition duration-300 hover:scale-105 hover:shadow-xl",
  addedClassName,
  onClick,
}) => {
  return (
    <article onClick={onClick} className={`${className} ${addedClassName}`}>
      {children}
    </article>
  );
};
