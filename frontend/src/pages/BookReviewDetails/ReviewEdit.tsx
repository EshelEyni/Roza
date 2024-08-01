import { FC } from "react";
import { Review, SlateCustomElement } from "../../../../shared/types/books";
import { SlateEditor } from "../../components/SlateTextEditor/TextEditor";
import { debounce } from "../../services/utilService";
import { useBookReview } from "../../contexts/ReviewContext";
import { useTranslation } from "react-i18next";
import { Modal } from "../../components/App/Modal";

type ReviewEditProps = {
  review: Review;
};

export const ReviewEdit: FC<ReviewEditProps> = ({ review }) => {
  const { updateBookReviewEntity } = useBookReview();
  const { t } = useTranslation();

  function handleChange(text: SlateCustomElement[]) {
    const updatedReview = { ...review, text };
    onUpdateReview(updatedReview);
  }

  function onRemoveReview(reviewId: string) {
    updateBookReviewEntity({ type: "removeReview", reviewId });
  }

  function onUpdateReview(updatedReview: Review) {
    updateBookReviewEntity({ type: "updateReview", review: updatedReview });
  }

  return (
    <div className="flex flex-col gap-2">
      <SlateEditor
        defaultValue={review.text}
        onChange={debounce(value => handleChange(value), 500).debouncedFunc}
      />

      <div className="flex items-center justify-end">
        <Modal>
          <Modal.OpenBtn modalName="archiveReview">
            <div>{t("btnDelete")}</div>
          </Modal.OpenBtn>

          <Modal.Window name="archiveReview">
            <div className="flex w-full flex-col gap-4">
              <div className="flex w-full flex-col gap-2">
                <h3 className="text-center text-2xl font-medium text-app-800">
                  {t("removeReviewMsg.title")}
                </h3>
                <p>{t("removeReviewMsg.msg")}</p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Modal.CloseBtn>
                    <span>{t("btnCancel")}</span>
                  </Modal.CloseBtn>

                  <Modal.CloseBtn onClickFn={() => onRemoveReview(review.id)}>
                    <span>{t("btnDelete")}</span>
                  </Modal.CloseBtn>
                </div>
              </div>
            </div>
          </Modal.Window>
        </Modal>
      </div>
    </div>
  );
};
