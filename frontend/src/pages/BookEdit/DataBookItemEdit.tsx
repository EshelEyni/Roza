import { FC } from "react";
import { useBook } from "../../contexts/BookContext";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Hr } from "../../components/Hr";
import { Button } from "../../components/Button";
import { isChapterType } from "../../../../shared/services/utilService";
import { BookItemTitle } from "../../components/Book/BookItemTitle";

export const DataBookItemEdit: FC = () => {
  const { book, dataItemType, dataItemId, item, itemTitle, text, chatperText } =
    useBook();
  const { t } = useTranslation();
  const navigate = useNavigate();

  function navigateToEdit() {
    if (!book) return;
    navigate(`/book-edit/${book.id}/${dataItemType}/${dataItemId}`);
  }

  if (!book || !dataItemType || !dataItemId || !item) return null;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4">
      <BookItemTitle />
      <Hr />
      <div className="flex w-full items-center justify-between gap-4">
        <h1 className="text-4xl font-bold text-app-800">{itemTitle}</h1>
        <Button
          onClickFn={navigateToEdit}
          className="rounded-md bg-app-500 px-4 py-1 text-white hover:bg-app-600"
        >
          {t("DataBookItemDetails.btnEdit")}
        </Button>
      </div>
      <Hr />
      <p className="w-full text-lg font-normal text-app-800">{text}</p>
      {isChapterType(item) && (
        <>
          <Hr />
          <p className="w-full text-lg font-normal text-app-800">
            {chatperText}
          </p>
        </>
      )}
    </div>
  );
};
