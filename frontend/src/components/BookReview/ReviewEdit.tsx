import { FC } from "react";
import { Review, SlateCustomElement } from "../../../../shared/types/books";
import { SlateEditor } from "../SlateTextEditor/TextEditor";
import { debounce } from "../../services/utilService";
import { useBookReview } from "../../contexts/ReviewContext";
import { useTranslation } from "react-i18next";
import { H3 } from "../Gen/H3";
import { BtnMinimize } from "../Buttons/BtnMinimize";
import { DeleteEntityModal } from "../Modals/DeleteEntityModal";
import { MinimizedText } from "./MinimizedText";
import { useMinimized } from "../../hooks/useIsMinimized";

type ReviewEditProps = {
  review: Review;
  index: number;
};

export const ReviewEdit: FC<ReviewEditProps> = ({ review, index }) => {
  const { updateBookReviewEntity } = useBookReview();
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
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <H3>
          {t("review")} {index + 1}
        </H3>
        <div className="flex items-center gap-2">
          <DeleteEntityModal
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
          defaultValue={review.text}
          onChange={debounce(value => handleChange(value), 500).debouncedFunc}
        />
      )}
    </div>
  );
};
