import { FC } from "react";
import { Review, SlateCustomElement } from "../../../../shared/types/books";
import { SlateEditor } from "../SlateTextEditor/SlateEditor";
import { debounce } from "../../services/utilService";
import { useBookReview } from "../../contexts/BookReviewContext";
import { useTranslation } from "react-i18next";
import { H3 } from "../App/H3";
import { BtnMinimize } from "../Buttons/BtnMinimize";
import { DeleteEntityModal } from "../Modals/DeleteEntityModal";
import { MinimizedText } from "./MinimizedText";
import { useMinimized } from "../../hooks/useIsMinimized";
import { Hr } from "../App/Hr";

type ReviewEditProps = {
  review: Review;
};

export const ReviewEdit: FC<ReviewEditProps> = ({ review }) => {
  const { bookReview, updateBookReviewEntity, getReviewNumber } =
    useBookReview();
  const reviewNumber = getReviewNumber(review.id);
  const { t } = useTranslation();
  const { isMinimized, setIsMinimized } = useMinimized({
    isMinimizedProp: review.isMinimized,
  });

  function handleChange(text: SlateCustomElement[]) {
    const updatedReview = { ...review, text };
    updateBookReviewEntity({ type: "updateReview", review: updatedReview });
  }

  function onRemoveReview(reviewId: string) {
    updateBookReviewEntity({ type: "removeReview", reviewId });
  }

  function onToggleMinimize() {
    setIsMinimized(!isMinimized);
    const updatedReview = { ...review, isMinimized: !review.isMinimized };
    updateBookReviewEntity({ type: "updateReview", review: updatedReview });
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="mb-3 flex items-center justify-between">
        <H3>
          {t("review")} {reviewNumber}
        </H3>
        <div className="flex items-center gap-2">
          <DeleteEntityModal
            isSmallOpenBtn={true}
            modalName="archiveReview"
            onDeleteEntity={() => onRemoveReview(review.id)}
            archiveTitle={t("removeReviewMsg.title")}
            archiveMsg={t("removeReviewMsg.msg")}
          />
          <BtnMinimize
            isMinimized={review.isMinimized}
            onToggleMinimize={onToggleMinimize}
          />
        </div>
      </div>
      {isMinimized ? (
        <MinimizedText textEl={review.text} />
      ) : (
        <SlateEditor
          initialValue={review.text}
          onChange={debounce(value => handleChange(value), 1500).debouncedFunc}
          fullScreenTitle={bookReview?.name || t("bookReview")}
        />
      )}
      <Hr />
    </section>
  );
};
