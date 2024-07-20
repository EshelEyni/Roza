import { FC } from "react";
import { useBook } from "../../contexts/BookContext";
import { useUpdateBook } from "../../hooks/reactQuery/update/useUpdateBook";
import { PageTitle } from "../PageTitle";
import { useTranslation } from "react-i18next";

type BookTitleProps = {
  isBookEdit?: boolean;
};

export const BookTitle: FC<BookTitleProps> = ({ isBookEdit = false }) => {
  const { book, isSuccessBook, onNavigateToEdit, onArchiveBook } = useBook();
  const { updateBook } = useUpdateBook();
  const { t } = useTranslation();

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!book) return;
    const name = e.target.value;
    updateBook({ ...book, name });
  }

  if (!isSuccessBook || !book) return null;
  return (
    <PageTitle
      isEdit={isBookEdit}
      entityName={book.name}
      handleInputChange={handleInputChange}
      onNavigateToEdit={onNavigateToEdit}
      modalName="archiveBook"
      onDeleteEntity={onArchiveBook}
      archiveTitle={t("archiveBookMsg.title")}
      archiveMsg={t("archiveBookMsg.msg")}
    />
  );
};
