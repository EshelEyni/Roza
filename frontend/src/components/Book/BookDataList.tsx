import { FC } from "react";
import { BookDataItem, BooKDataItemType } from "../../../../shared/types/books";
import { BookDataPreview } from "./BookDataPreview";
import { useBook } from "../../contexts/BookContext";
import { DndListWrapper } from "../Gen/DndListWrapper";

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
  const { book, updateBook } = useBook();

  function dragEndCallback(items: BookDataItem[]) {
    if (!book) return;
    const newBook = { ...book, [type]: items };
    updateBook(newBook);
  }

  function renderItem(item: BookDataItem) {
    return <BookDataPreview dataItem={item} type={type} isEdit={isEdit} />;
  }

  if (!isRendered || !book) return null;
  const data = book[type] as BookDataItem[];

  return (
    <DndListWrapper
      items={data}
      renderItem={renderItem}
      dragEndCallback={dragEndCallback}
    />
  );
};
