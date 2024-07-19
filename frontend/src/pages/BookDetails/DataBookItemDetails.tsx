import { FC } from "react";
import { useBook } from "../../contexts/BookContext";
import { useTranslation } from "react-i18next";
import { Hr } from "../../components/Hr";
import { isChapterType } from "../../../../shared/services/utilService";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { BookItemTitle } from "../../components/Book/BookItemTitle";

export const DataBookItemDetails: FC = () => {
  const {
    book,
    dataItemType,
    dataItemId,
    item,
    itemTitle,
    text,
    chatperText,
    onNavigateToEdit,
    onDeleteItem,
  } = useBook();

  const { t } = useTranslation();

  if (!book || !dataItemType || !dataItemId || !item) return null;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4">
      <BookItemTitle />
      <Hr />
      <div className="flex w-full items-center justify-between gap-4">
        <h1 className="text-4xl font-bold text-app-800">{itemTitle}</h1>

        <div className="flex items-center justify-between gap-4 bg-app-100">
          <Button onClickFn={onNavigateToEdit}>
            {t("DataBookItemDetails.btnEdit")}
          </Button>
          <Modal>
            <Modal.OpenBtn modalName="deleteBookDataItem">
              <button>{t("BookDataPreview.btnDelete")}</button>
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
                <Button onClickFn={onDeleteItem}>
                  {t("BookDataPreview.btnDelete")}
                </Button>
              </div>
            </Modal.Window>
          </Modal>
        </div>
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
