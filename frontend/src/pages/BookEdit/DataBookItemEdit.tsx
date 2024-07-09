import { FC } from "react";
import { useBook } from "../../contexts/BookContext";
import { useGetTitleTextBookItem } from "../../hooks/useGetTitleTextBookItem";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Book, BookDataItem, Chapter } from "../../../../shared/types/books";
import { Hr } from "../../components/Hr";
import { Button } from "../../components/Button";
import { isChapterType } from "../../../../shared/services/utilService";

export const DataBookItemEdit: FC = () => {
  const { book, dataItem, dataItemId } = useBook();
  const { getTitle, getText } = useGetTitleTextBookItem();
  const { t } = useTranslation();
  const navigate = useNavigate();

  function navigateToEdit() {
    if (!book) return;
    navigate(`/book-edit/${book.id}/${dataItem}/${dataItemId}`);
  }

  if (!book || !dataItem || !dataItemId) return null;

  const item = (book[dataItem as keyof Book] as BookDataItem[]).find(
    i => i.id === dataItemId,
  );
  if (!item) return null;
  const pageTitle = t(`DataBookItemDetails.pageTitle.${dataItem}`);
  const itemTitle = getTitle(item, dataItem);
  const text = getText(item, dataItem);
  const chatperText = (item as Chapter).text;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4">
      <h2 className="w-full text-2xl font-bold text-app-900">{pageTitle}</h2>
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
