import { FC } from "react";
import {
  BooKDataItemType,
  Chapter,
  Character,
  Note,
  Plotline,
  Theme,
} from "../../../../shared/types/books";
import { BookDataPreview } from "./BookDataPreview";

type BookDataListProps = {
  data: Chapter[] | Character[] | Theme[] | Plotline[] | Note[];
  isRendered: boolean;
  type: BooKDataItemType;
};

export const BookDataList: FC<BookDataListProps> = ({
  data,
  isRendered,
  type,
}) => {
  if (!isRendered) return null;

  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {data
        .filter(d => !d.isDeleted)
        .map(d => (
          <li key={d.id}>
            <BookDataPreview dataItem={d} type={type} />
          </li>
        ))}
    </ul>
  );
};
