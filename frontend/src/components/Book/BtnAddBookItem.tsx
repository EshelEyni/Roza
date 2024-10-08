import { FC } from "react";
import { useBook } from "../../contexts/BookContext";
import { useUpdateBook } from "../../hooks/reactQuery/update/useUpdateBook";
import { getDefaultBookDataItem } from "../../services/bookUtilService";
import { Button } from "../Buttons/Button";
import { useTranslation } from "react-i18next";

export const BtnAddBookItem: FC = () => {
  const { book, filterBy } = useBook();

  const { updateBook } = useUpdateBook(book?.filterBy);
  const { t } = useTranslation();

  function handleAddBookDataItem() {
    if (!book) return;
    const type = filterBy;
    const newItem = getDefaultBookDataItem({ bookId: book.id, type });
    updateBook({ ...book, [type]: [...book[type], newItem] });
  }

  if (!book) return null;
  return (
    <Button onClick={handleAddBookDataItem} addedClassName="self-end">
      {t(`BtnAddBookItem.${filterBy}`)}
    </Button>
  );
};
