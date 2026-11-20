import { FC } from "react";

type ArticleProps = {
  children: React.ReactNode;
  className?: string;
  addedClassName?: string;
  onClick?: () => void;
};

export const Article: FC<ArticleProps> = ({
  children,
  className = "ui-card",
  addedClassName,
  onClick,
}) => {
  return (
    <article onClick={onClick} className={`${className} ${addedClassName ?? ""}`}>
      {children}
    </article>
  );
};
