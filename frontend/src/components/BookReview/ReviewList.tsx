import { FC } from "react";
import { Review } from "../../../../shared/types/books";
import { useTranslation } from "react-i18next";
import { ReviewDisplay } from "./ReviewDisplay";
import { ReviewEdit } from "./ReviewEdit";
import { useBookReview } from "../../contexts/ReviewContext";
import { Button } from "../Buttons/Button";
import { Hr } from "../Gen/Hr";
import { H2 } from "../Gen/H2";
import { BtnMinimizeAll } from "../Buttons/BtnMinimizeAll";

type ReviewListProps = {
  reviews: Review[];
  isEdit?: boolean;
};

export const ReviewList: FC<ReviewListProps> = ({ reviews, isEdit }) => {
  const { updateBookReviewEntity, onNavigateToEdit } = useBookReview();
  const { t } = useTranslation();

  const isAllMinimized = reviews.every(review => review.isMinimized);

  function handleAddReview() {
    updateBookReviewEntity({ type: "addReview" });
    if (!isEdit) onNavigateToEdit();
  }

  function onToggleMinimize() {
    updateBookReviewEntity({
      type: "toggleMinimizeReviews",
      isMinimized: !isAllMinimized,
    });
  }

  return (
    <div className="w-full font-normal text-app-800">
      <div className="mb-1 flex items-center justify-between">
        <H2>{t("reviews")}</H2>
        <div className="flex items-center gap-2">
          <BtnMinimizeAll
            isMinimized={isAllMinimized}
            onToggleMinimize={onToggleMinimize}
          />
          <Button onClickFn={handleAddReview}>{t("btnAdd")}</Button>
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {reviews.map((review, i) => (
          <li key={review.id}>
            <Hr />
            {isEdit ? (
              <ReviewEdit review={review} index={i} />
            ) : (
              <ReviewDisplay review={review} index={i} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
