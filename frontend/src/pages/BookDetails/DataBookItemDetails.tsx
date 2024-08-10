import { FC } from "react";
import { useBook } from "../../contexts/BookContext";
import { useTranslation } from "react-i18next";
import { Hr } from "../../components/App/Hr";
import { isChapterType } from "../../../../shared/services/utilService";
import { Button } from "../../components/Buttons/Button";
import { BookItemTitle } from "../../components/Book/BookItemTitle";
import { TextElement } from "../../components/App/TextElement";
import { DeleteEntityModal } from "../../components/Modals/DeleteEntityModal";

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

          <DeleteEntityModal
            modalName={"deleteBookDataItem"}
            onDeleteEntity={onDeleteItem}
            archiveTitle={t("confirmItemDeleteMsg.title")}
            archiveMsg={t("confirmItemDeleteMsg.msg")}
          />
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
