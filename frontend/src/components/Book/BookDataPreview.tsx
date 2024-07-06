import { FC } from "react";
import {
  BooKDataItemType,
  Chapter,
  Character,
  Note,
  Plotline,
  Theme,
} from "../../../../shared/types/books";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "../Button";
import { Modal } from "../Modal";
import { useBook } from "../../contexts/BookContext";
import { useUpdateBook } from "../../hooks/reactQuery/update/useUpdateBook";

type BookDataPreviewProps = {
  dataItem: Chapter | Character | Theme | Plotline | Note;
  type: BooKDataItemType;
};

export const BookDataPreview: FC<BookDataPreviewProps> = ({
  dataItem,
  type,
}) => {
  const { book } = useBook();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { updateBook } = useUpdateBook();

  const title = getTitle(dataItem);
  const text = getText(dataItem);
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

  function getTitle(dataItem: Chapter | Character | Theme | Plotline | Note) {
    const name = t(`BookDataPreview.name.${type}`);

    switch (type) {
      case "chapters":
        return (dataItem as Character).name || name;
      case "characters":
        return (dataItem as Chapter).name || name;
      case "themes":
        return (dataItem as Theme).name || name;
      case "plotlines":
        return (dataItem as Plotline).name || name;
      case "notes":
        return `${t("BookDataPreview.noteTitlePrefix")} ${dataItem.sortOrder}`;
    }
  }

  function getText(dataItem: Chapter | Character | Theme | Plotline | Note) {
    const { description, text } = {
      description: t("BookDataPreview.description"),
      text: t("BookDataPreview.text"),
    };

    switch (type) {
      case "chapters":
        return (dataItem as Chapter).description || description;
      case "characters":
        return (dataItem as Character).description || description;
      case "themes":
        return (dataItem as Theme).description || description;
      case "plotlines":
        return (dataItem as Plotline).description || description;
      case "notes":
        return (dataItem as Note).text || text;
    }
  }

  function onOpenItem() {
    navigate(`${type}/${dataItem.id}`);
  }

  function onEditItem() {
    navigate(`/book-edit/${dataItem.bookId}/${type}/${dataItem.id}`);
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
    <article className="scrollbar-hidden flex h-full max-h-[350px] cursor-pointer flex-col gap-2 overflow-y-auto rounded-lg border border-app-900 p-3 shadow-lg transition duration-300 hover:scale-105 hover:shadow-xl">
      <h2 className="mb-2 text-xl font-bold text-app-800">{title}</h2>
      <p className="text-app-900">{text}</p>
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
    </article>
  );
};
