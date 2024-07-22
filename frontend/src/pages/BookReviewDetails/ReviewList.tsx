import { FC } from "react";
import { Review } from "../../../../shared/types/books";
import { useTranslation } from "react-i18next";
import { ReviewDisplay } from "./ReviewDisplay";
import { ReviewEdit } from "./ReviewEdit";
import { useBookReview } from "../../contexts/ReviewContext";
import { Button } from "../../components/Button";
import { Hr } from "../../components/Hr";

type ReviewListProps = {
  reviews: Review[];
  isEdit?: boolean;
};

export const ReviewList: FC<ReviewListProps> = ({ reviews, isEdit }) => {
  const { onAddReview } = useBookReview();
  const { t } = useTranslation();
  if (!reviews.length) return null;
  return (
    <div className="w-full font-normal text-app-800">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="mb-2 text-2xl font-bold text-app-800">{t("reviews")}</h2>
        <Button onClickFn={onAddReview}>{t("btnAdd")}</Button>
      </div>

      <ul className="flex flex-col gap-2">
        {reviews.map((review, idx) => (
          <li key={idx}>
            {isEdit ? (
              <ReviewEdit key={idx} review={review} />
            ) : (
              <ReviewDisplay key={idx} review={review} />
            )}
            <Hr />
          </li>
        ))}
      </ul>
    </div>
  );
};
