import { FC } from "react";
import { useBook } from "../../contexts/BookContext";
import { useTranslation } from "react-i18next";
import { Hr } from "../../components/Gen/Hr";
import { isChapterType } from "../../../../shared/services/utilService";
import { Button } from "../../components/Buttons/Button";
import { Modal } from "../../components/Modals/Modal";
import { BookItemTitle } from "../../components/Book/BookItemTitle";
import { TextElement } from "../../components/Gen/TextElement";

export const DataBookItemDetails: FC = () => {
  const {
    book,
    dataItemType,
    dataItemId,
    item,
    itemTitle,
    textEl,
    chatperTextEl,
    onNavigateToEdit,
    onDeleteItem,
    onDownloadChapter,
  } = useBook();

  const { t } = useTranslation();

  if (!book || !dataItemType || !dataItemId || !item) return null;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4">
      <BookItemTitle />
      <Hr />
      <div className="flex w-full items-center justify-between gap-4">
        <h1 className="text-4xl font-bold text-app-800">{itemTitle}</h1>

        <div className="flex items-center justify-between gap-3 bg-app-100">
          {isChapterType(item) && (
            <Button onClickFn={onDownloadChapter}>{t("download")}</Button>
          )}
          <Button onClickFn={onNavigateToEdit}>{t("btnEdit")}</Button>
          <Modal>
            <Modal.OpenBtn modalName="deleteBookDataItem">
              <button>{t("btnDelete")}</button>
            </Modal.OpenBtn>

            <Modal.Window name="deleteBookDataItem">
              <div className="flex w-full flex-col items-center gap-4">
                <h3 className="text-xl font-bold text-app-800">
                  {t("confirmItemDeleteMsg.title")}
                </h3>
                <p className="text-app-900">{t("confirmItemDeleteMsg.msg")}</p>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Modal.CloseBtn className="rounded-md bg-app-500 px-3 py-1 text-white hover:bg-app-600">
                  <div>{t("btnCancel")}</div>
                </Modal.CloseBtn>
                <Button onClickFn={onDeleteItem}>{t("btnDelete")}</Button>
              </div>
            </Modal.Window>
          </Modal>
        </div>
      </div>
      <Hr />
      <div className="w-full text-2xl font-normal text-app-800">
        {textEl.map((el, i) => (
          <TextElement element={el} key={i} />
        ))}
      </div>
      {isChapterType(item) && (
        <>
          <Hr />
          <div className="w-full text-2xl font-normal text-app-800">
            {chatperTextEl.map((el, i) => (
              <TextElement element={el} key={i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
