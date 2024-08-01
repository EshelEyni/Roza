import { FC } from "react";
import { Review } from "../../../../shared/types/books";
import { useTranslation } from "react-i18next";
import { ReviewDisplay } from "./ReviewDisplay";
import { ReviewEdit } from "./ReviewEdit";
import { useBookReview } from "../../contexts/ReviewContext";
import { Button } from "../../components/Buttons/Button";
import { Hr } from "../../components/Gen/Hr";

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
        <h2 className="mb-2 text-2xl font-bold text-app-800">{t("reviews")}</h2>
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
