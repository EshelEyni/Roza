import { FC } from "react";
import { Reference } from "../../../../shared/types/books";

type ReferenceListProps = {
  references: Reference[];
};

export const ReferenceList: FC<ReferenceListProps> = ({ references }) => {
  if (!references.length) return null;
  return <div>ReferenceList</div>;
};
