import { FC } from "react";
import { useBook } from "../../contexts/BookContext";
import { useTranslation } from "react-i18next";
import { Hr } from "../../components/Hr";
import { Book, BookDataItem, Chapter } from "../../../../shared/types/books";
import { isChapterType } from "../../../../shared/services/utilService";
import { useGetTitleTextBookItem } from "../../hooks/useGetTitleTextBookItem";

export const DataBookItemDetails: FC = () => {
  const { book, dataItem, dataItemId } = useBook();
  const { getTitle, getText } = useGetTitleTextBookItem();
  const { t } = useTranslation();

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
      <h1 className="w-full text-4xl font-bold text-app-800">{itemTitle}</h1>
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
