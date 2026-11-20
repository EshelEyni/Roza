import { FC } from "react";

type EntityListTitleContainerProps = {
  children: React.ReactNode;
};

export const EntityListTitleContainer: FC<EntityListTitleContainerProps> = ({
  children,
}) => {
  return (
    <div className="ui-list-title">
      {children}
    </div>
  );
};
