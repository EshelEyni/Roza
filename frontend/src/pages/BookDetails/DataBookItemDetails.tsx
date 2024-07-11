import { FC, useEffect, useState } from "react";
import { useBook } from "../../contexts/BookContext";
import { useTranslation } from "react-i18next";
import { Hr } from "../../components/Hr";
import { Book, BookDataItem, Chapter } from "../../../../shared/types/books";
import { isChapterType } from "../../../../shared/services/utilService";
import { useGetTitleTextBookItem } from "../../hooks/useGetTitleTextBookItem";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { useUpdateBook } from "../../hooks/reactQuery/update/useUpdateBook";

export const DataBookItemDetails: FC = () => {
  const { book, dataItemType, dataItemId } = useBook();
  const [item, setItem] = useState<BookDataItem | null>(null);
  const { getTitle, getText } = useGetTitleTextBookItem();
  const { updateBook } = useUpdateBook();
  const { t } = useTranslation();
  const navigate = useNavigate();

  function navigateToEdit() {
    if (!book) return;
    navigate(`/book-edit/${book.id}/${dataItemType}/${dataItemId}`);
  }

  function onDeleteItem() {
    if (!book || !dataItemType || !dataItemId || !item) return;
    function updateDeletedStatus<T extends { id: string }>(
      items: T[],
      id: string,
    ): T[] {
      return items.map(item =>
        item.id === id ? { ...item, isDeleted: true } : item,
      );
    }

    const newBook = { ...book };

    switch (dataItemType) {
      case "chapters":
        newBook.chapters = updateDeletedStatus(newBook.chapters, item.id);
        break;
      case "characters":
        newBook.characters = updateDeletedStatus(newBook.characters, item.id);
        break;
      case "themes":
        newBook.themes = updateDeletedStatus(newBook.themes, item.id);
        break;
      case "plotlines":
        newBook.plotlines = updateDeletedStatus(newBook.plotlines, item.id);
        break;
      case "notes":
        newBook.notes = updateDeletedStatus(newBook.notes, item.id);
        break;
    }

    updateBook(newBook);
  }

  useEffect(() => {
    if (!book || !dataItemType || !dataItemId) return;
    const item =
      ((book[dataItemType as keyof Book] as BookDataItem[]).find(
        i => i.id === dataItemId,
      ) as BookDataItem) || null;

    setItem(item);

    return () => {
      setItem(null);
    };
  }, [book, dataItemType, dataItemId]);

  if (!book || !dataItemType || !dataItemId || !item) return null;
  const pageTitle = t(`DataBookItemDetails.pageTitle.${dataItemType}`);
  const itemTitle = getTitle(item, dataItemType);
  const text = getText(item, dataItemType);
  const chatperText = (item as Chapter).text;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4">
      <div className="flex w-full items-center justify-between gap-4 bg-app-100 px-4 py-2">
        <h2 className="w-full text-2xl font-bold text-app-900">{pageTitle}</h2>

        <Modal>
          <Modal.OpenBtn
            className="rounded-md bg-app-500 px-3 text-white hover:bg-app-600"
            modalName="deleteBookDataItem"
          >
            <div>{t("BookDataPreview.btnDelete")}</div>
          </Modal.OpenBtn>

          <Modal.Window name="deleteBookDataItem">
            <div className="flex w-full flex-col items-center gap-4">
              <h3 className="text-xl font-bold text-app-800">
                {t("BookDataPreview.confirmDeleteMsg.title")}
              </h3>
              <p className="text-app-900">
                {t("BookDataPreview.confirmDeleteMsg.msg")}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Modal.CloseBtn className="rounded-md bg-app-500 px-3 py-1 text-white hover:bg-app-600">
                <div>{t("BookDataPreview.btnCancel")}</div>
              </Modal.CloseBtn>
              <Button
                onClickFn={onDeleteItem}
                className="rounded-md bg-app-500 px-3 py-1 text-white hover:bg-app-600"
              >
                {t("BookDataPreview.btnDelete")}
              </Button>
            </div>
          </Modal.Window>
        </Modal>
      </div>
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
