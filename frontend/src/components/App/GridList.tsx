import { FC } from "react";

type GridListProps = {
  children: React.ReactNode;
  className?: string;
};

export const GridList: FC<GridListProps> = ({
  children,
  className = "ui-grid",
}) => {
  return <ul className={className}>{children}</ul>;
};
