import { FC } from "react";

type GridListProps = {
  children: React.ReactNode;
  className?: string;
};

export const GridListItem: FC<GridListProps> = ({
  children,
  className = "",
}) => {
  return <li className={className}>{children}</li>;
};
