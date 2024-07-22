import { FC } from "react";
import { BookDataItem, BooKDataItemType } from "../../../../shared/types/books";
import { BookDataPreview } from "./BookDataPreview";
import { useBook } from "../../contexts/BookContext";

type BookDataListProps = {
  isRendered: boolean;
  type: BooKDataItemType;
  isEdit?: boolean;
};

export const BookDataList: FC<BookDataListProps> = ({
  isRendered,
  type,
  isEdit = false,
}) => {
  const { book } = useBook();
  if (!isRendered || !book) return null;
  const data = book[type] as BookDataItem[];
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {data
        .filter(d => !d.isDeleted)
        .map(d => (
          <li key={d.id}>
            <BookDataPreview dataItem={d} type={type} isEdit={isEdit} />
          </li>
        ))}
    </ul>
  );
};
