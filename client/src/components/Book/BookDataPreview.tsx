import { FC } from "react";
import {
  BooKDataItemType,
  Chapter,
  Character,
  Note,
  Plotline,
  Theme,
} from "@rozaeyni/common-types";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "../Button";
import { Modal } from "../Modal";
import { useUpdateBook } from "../../hooks/reactQuery/update/useUpdateBook";
import { useGetTitleTextBookItem } from "../../hooks/useGetTitleTextBookItem";
import { useBook } from "../../contexts/BookContext";

type BookDataPreviewProps = {
  dataItem: Chapter | Character | Theme | Plotline | Note;
  type: BooKDataItemType;
  isBookEdit?: boolean;
};

export const BookDataPreview: FC<BookDataPreviewProps> = ({
  dataItem,
  type,
  isBookEdit = false,
}) => {
  const { book } = useBook();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getTitle, getText } = useGetTitleTextBookItem();
  const { updateBook } = useUpdateBook();

  const title = getTitle(dataItem, type);
  const text = getText(dataItem, type);
  const btns = [
    {
      title: t("BookDataPreview.btnOpen"),
      onClick: onOpenItem,
    },
    {
      title: t("BookDataPreview.btnEdit"),
      onClick: onEditItem,
    },
  ];

  function onOpenItem() {
    navigate(`${type}/${dataItem.id}`);
  }

  function onEditItem() {
    navigate(`/book-edit/${dataItem.bookId}/${type}/${dataItem.id}`);
  }

  function handlePreviewClick() {
    // if (!isBookEdit) return;
    onEditItem();
  }

  function onDeleteItem() {
    if (!book) return;
    function updateDeletedStatus<T extends { id: string }>(
      items: T[],
      id: string,
    ): T[] {
      return items.map(item =>
        item.id === id ? { ...item, isDeleted: true } : item,
      );
    }

    const newBook = { ...book };

    switch (type) {
      case "chapters":
        newBook.chapters = updateDeletedStatus(newBook.chapters, dataItem.id);
        break;
      case "characters":
        newBook.characters = updateDeletedStatus(
          newBook.characters,
          dataItem.id,
        );
        break;
      case "themes":
        newBook.themes = updateDeletedStatus(newBook.themes, dataItem.id);
        break;
      case "plotlines":
        newBook.plotlines = updateDeletedStatus(newBook.plotlines, dataItem.id);
        break;
      case "notes":
        newBook.notes = updateDeletedStatus(newBook.notes, dataItem.id);
        break;
    }

    updateBook(newBook);
  }

  return (
    <article
      onClick={handlePreviewClick}
      className="flex h-full max-h-[350px] cursor-pointer flex-col gap-2 rounded-lg border border-app-900 p-3 shadow-lg transition duration-300 hover:scale-105 hover:shadow-xl"
    >
      <h2 className="mb-2 text-xl font-bold text-app-800">{title}</h2>
      <p className="overflow-y-auto text-app-900">{text}</p>
      {/* {!isBookEdit && (
        <div className="flex flex-wrap items-center justify-end gap-1">
          {btns.map((btn, index) => (
            <Button
              key={index}
              className="rounded-md bg-app-500 px-3 text-white hover:bg-app-600"
              onClickFn={btn.onClick}
            >
              {btn.title}
            </Button>
          ))}
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
      )} */}
    </article> 
  );
};
