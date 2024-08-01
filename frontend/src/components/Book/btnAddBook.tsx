import { FC } from "react";
import { useBook } from "../../contexts/BookContext";
import { useUpdateBook } from "../../hooks/reactQuery/update/useUpdateBook";
import { getDefaultBookDataItem } from "../../services/bookUtilService";
import { Button } from "../Buttons/Button";
import { useTranslation } from "react-i18next";

export const BtnAddBook: FC = () => {
  const { book } = useBook();

  const { updateBook } = useUpdateBook(book?.filterBy);
  const { t } = useTranslation();

  function handleAddBookDataItem() {
    if (!book) return;
    const type = book.filterBy;
    const newItem = getDefaultBookDataItem({ bookId: book.id, type });
    updateBook({ ...book, [type]: [...book[type], newItem] });
  }

  if (!book) return null;
  return (
    <Button
      className="rounded-md bg-app-500 px-4 py-2 text-white hover:bg-app-600"
      onClickFn={handleAddBookDataItem}
    >
      {t(`BookPage.btnAdd.${book.filterBy}`)}
    </Button>
  );
};
