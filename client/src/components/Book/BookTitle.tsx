import { FC, useState } from "react";
import { DisplayEditField } from "../JobApplicationField";
import { useBook } from "../../contexts/BookContext";
import { useUpdateBook } from "../../hooks/reactQuery/update/useUpdateBook";
import { useTranslation } from "react-i18next";

type BookTitleProps = {
  isBookEdit?: boolean;
};

export const BookTitle: FC<BookTitleProps> = ({ isBookEdit = false }) => {
  const [bookName, setBookName] = useState<string>("");
  const { book, isSuccessBook } = useBook();
  const { updateBook } = useUpdateBook();
  const { t } = useTranslation();

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setBookName(e.target.value);
  }

  function handleSaveClick() {
    if (!book || !bookName) return;
    updateBook({ ...book, name: bookName });
    setBookName("");
  }

  if (!isSuccessBook || !book) return null;
  if (isBookEdit)
    return (
      <div className="flex w-full items-center justify-between gap-4">
        <input
          type="text"
          defaultValue={book.name}
          className="rounded-md border border-app-900 px-4 py-2 text-3xl font-bold text-app-800"
          onChange={handleInputChange}
        />

        <button
          onSubmit={handleSaveClick}
          className="rounded-md bg-app-500 px-4 py-2 text-white hover:bg-app-600"
        >
          {t("btnSave")}
        </button>
      </div>
    );

  return (
    <DisplayEditField>
      <div className="flex w-full items-center justify-between gap-4">
        <DisplayEditField.DisplayElement className="mb-4 text-4xl font-bold text-app-800">
          <h1>{book.name}</h1>
        </DisplayEditField.DisplayElement>
        <DisplayEditField.EditButton className="rounded-md bg-app-500 px-4 py-2 text-white hover:bg-app-600">
          <button>{t("btnEdit")}</button>
        </DisplayEditField.EditButton>
      </div>

      <div className="flex w-full items-center justify-between gap-4">
        <DisplayEditField.EditElement
          className="rounded-md border border-app-900 px-4 py-2 text-3xl font-bold text-app-800"
          onChange={handleInputChange}
        >
          <input type="text" defaultValue={book.name} />
        </DisplayEditField.EditElement>

        <DisplayEditField.SaveButton
          onSubmit={handleSaveClick}
          className="rounded-md bg-app-500 px-4 py-2 text-white hover:bg-app-600"
        >
          <button>{t("btnSave")}</button>
        </DisplayEditField.SaveButton>
      </div>
    </DisplayEditField>
  );
};
