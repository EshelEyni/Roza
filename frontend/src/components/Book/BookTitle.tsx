import { FC } from "react";
import { useBook } from "../../contexts/BookContext";
import { useUpdateBook } from "../../hooks/reactQuery/update/useUpdateBook";
import { useTranslation } from "react-i18next";
import { Button } from "../Button";
import { debounce } from "../../services/utilService";
import { GoBackBtn } from "../GoBackBtn";

type BookTitleProps = {
  isBookEdit?: boolean;
};

export const BookTitle: FC<BookTitleProps> = ({ isBookEdit = false }) => {
  const { book, isSuccessBook, onNavigateToEdit } = useBook();
  const { updateBook } = useUpdateBook();
  const { t } = useTranslation();

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!book) return;
    const name = e.target.value;
    updateBook({ ...book, name });
  }

  if (!isSuccessBook || !book) return null;

  return (
    <div className="flex w-full flex-col items-center justify-between gap-4">
      <div className="flex w-full items-center justify-between gap-4">
        <h2 className="text-3xl font-bold text-app-800">{t("book")}</h2>
        <GoBackBtn />
      </div>
      {isBookEdit ? (
        <input
          type="text"
          defaultValue={book.name}
          className="w-full rounded-md border border-app-900 bg-gray-50 px-4 py-2 text-3xl font-bold text-app-700"
          onChange={debounce(e => handleInputChange(e), 500).debouncedFunc}
        />
      ) : (
        <div className="flex w-full items-center justify-between gap-4">
          <h1 className="mb-4 text-4xl font-bold text-app-800">{book.name}</h1>
          <Button onClickFn={onNavigateToEdit}>
            <span>{t("btnEdit")}</span>
          </Button>
        </div>
      )}
    </div>
  );
};
