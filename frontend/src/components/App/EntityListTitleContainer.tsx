import { FC } from "react";

type EntityListTitleContainerProps = {
  children: React.ReactNode;
};

export const EntityListTitleContainer: FC<EntityListTitleContainerProps> = ({
  children,
}) => {
  return (
    <div className="flex items-center justify-between border-b border-app-800 bg-app-100 pb-3">
      {children}
    </div>
  );
};
