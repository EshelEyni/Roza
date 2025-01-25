import { FC } from "react";
import { useBookReview } from "../../contexts/BookReviewContext";
import { Reference, SlateCustomElement } from "../../../../shared/types/books";
import { ImgInput } from "./ImgInput";
import { useTranslation } from "react-i18next";
import { debounce } from "../../services/utilService";
import { SlateEditor } from "../SlateTextEditor/SlateEditor";
import { ImgList } from "./ImgList";
import { useMinimized } from "../../hooks/useIsMinimized";
import { BtnMinimize } from "../Buttons/BtnMinimize";
import { MinimizedText } from "./MinimizedText";
import classnames from "classnames";
import { DeleteEntityModal } from "../Modals/DeleteEntityModal";
import { Input } from "../App/Input";

type ReferenceEditProps = {
  reference: Reference;
};

export const ReferenceEdit: FC<ReferenceEditProps> = ({ reference }) => {
  const { bookReview, updateBookReviewEntity } = useBookReview();
  const { t } = useTranslation();
  const { isMinimized, setIsMinimized } = useMinimized({
    isMinimizedProp: reference.isMinimized,
  });

  function handlePagesInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    updateBookReviewEntity({
      type: "updateReference",
      reference: { ...reference, pages: e.target.value },
    });
  }

  function handleTextChange(text: SlateCustomElement[]) {
    const updatedReference = { ...reference, text };
    updateBookReviewEntity({
      type: "updateReference",
      reference: updatedReference,
    });
  }

  function onToggleMinimize() {
    setIsMinimized(!isMinimized);
    const updatedReference = {
      ...reference,
      isMinimized: !reference.isMinimized,
    };
    updateBookReviewEntity({
      type: "updateReference",
      reference: updatedReference,
    });
  }

  function handleDeleteReference() {
    updateBookReviewEntity({
      type: "removeReference",
      referenceId: reference.id,
    });
  }

  if (!reference) return null;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Input
          type="text"
          defaultValue={reference.pages}
          placeholder={t("pages")}
          className={classnames(
            "w-full rounded-md border border-app-800 px-1 py-2 text-center text-app-700",
            {
              "max-w-[150px]": !isMinimized,
              "max-w-[100px]": isMinimized,
            },
          )}
          onChange={e =>
            debounce(e => handlePagesInputChange(e), 1500).debouncedFunc(e)
          }
        />
        {isMinimized && (
          <MinimizedText textEl={reference.text} maxLength={50} />
        )}
        <div className="flex items-center gap-3">
          {!isMinimized && <ImgInput reference={reference} />}
          <BtnMinimize
            isMinimized={reference.isMinimized}
            onToggleMinimize={onToggleMinimize}
          />
        </div>
      </div>

      {!isMinimized && (
        <>
          <SlateEditor
            initialValue={reference.text}
            onChange={
              debounce(value => handleTextChange(value), 1500).debouncedFunc
            }
            fullScreenTitle={bookReview?.name || t("bookReview")}
          />

          <ImgList reference={reference} imgs={reference.imgs} />
          <div className="flex items-center justify-end gap-3">
            <DeleteEntityModal
              isSmallOpenBtn={true}
              archiveTitle={t("removeReferenceMsg.title")}
              archiveMsg={t("removeReferenceMsg.msg")}
              modalName="deleteReference"
              onDeleteEntity={handleDeleteReference}
            />
          </div>
        </>
      )}
    </section>
  );
};
