import { FC } from "react";
import { useBook } from "../../contexts/BookContext";
import { useTranslation } from "react-i18next";
import { Hr } from "../../components/App/Hr";
import { isChapterType } from "../../../../shared/services/utilService";
import { Button } from "../../components/Buttons/Button";
import { BookItemTitle } from "../../components/Book/BookItemTitle";
import { TextElement } from "../../components/App/TextElement";
import { DeleteEntityModal } from "../../components/Modals/DeleteEntityModal";
import { Header } from "../../components/App/Header";
import { H1 } from "../../components/App/H1";

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
    <div className="flex h-full w-full flex-col items-center justify-center gap-1">
      <BookItemTitle />
      <Hr />
      <Header addedClassName="flex-col sm:flex-row">
        <H1>{itemTitle}</H1>

        <div className="flex items-center justify-between gap-3 bg-app-100">
          {isChapterType(item) && (
            <Button onClick={onDownloadChapter}>{t("download")}</Button>
          )}
          <Button onClick={onNavigateToEdit}>{t("btnEdit")}</Button>

          <DeleteEntityModal
            modalName={"deleteBookDataItem"}
            onDeleteEntity={onDeleteItem}
            archiveTitle={t("confirmItemDeleteMsg.title")}
            archiveMsg={t("confirmItemDeleteMsg.msg")}
          />
        </div>
      </Header>
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
