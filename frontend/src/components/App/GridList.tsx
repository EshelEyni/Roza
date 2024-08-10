import { FC } from "react";

type GridListProps = {
  children: React.ReactNode;
  className?: string;
};

export const GridList: FC<GridListProps> = ({
  children,
  className = "mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3",
}) => {
  return <ul className={className}>{children}</ul>;
};
