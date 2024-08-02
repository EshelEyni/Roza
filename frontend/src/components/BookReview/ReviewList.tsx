import { FC } from "react";
import { Review } from "../../../../shared/types/books";
import { useTranslation } from "react-i18next";
import { ReviewDisplay } from "./ReviewDisplay";
import { ReviewEdit } from "./ReviewEdit";
import { useBookReview } from "../../contexts/ReviewContext";
import { Button } from "../Buttons/Button";
import { Hr } from "../Gen/Hr";
import { H2 } from "../Gen/H2";

type ReviewListProps = {
  reviews: Review[];
  isEdit?: boolean;
};

export const ReviewList: FC<ReviewListProps> = ({ reviews, isEdit }) => {
  const { updateBookReviewEntity, onNavigateToEdit } = useBookReview();
  const { t } = useTranslation();

  function handleAddReview() {
    updateBookReviewEntity({ type: "addReview" });
    if (!isEdit) onNavigateToEdit();
  }

  return (
    <div className="w-full font-normal text-app-800">
      <div className="mb-1 flex items-center justify-between">
        <H2>{t("reviews")}</H2>
        <Button onClickFn={handleAddReview}>{t("btnAdd")}</Button>
      </div>

      <ul className="flex flex-col gap-2">
        {reviews.map((review, i) => (
          <li key={review.id}>
            {isEdit ? (
              <ReviewEdit review={review} />
            ) : (
              <ReviewDisplay review={review} />
            )}
            {i < reviews.length - 1 && <Hr />}
          </li>
        ))}
      </ul>
    </div>
  );
};
