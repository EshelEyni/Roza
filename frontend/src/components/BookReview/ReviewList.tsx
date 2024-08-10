import { FC } from "react";
import { Review } from "../../../../shared/types/books";
import { useTranslation } from "react-i18next";
import { ReviewDisplay } from "./ReviewDisplay";
import { ReviewEdit } from "./ReviewEdit";
import { useBookReview } from "../../contexts/BookReviewContext";
import { Button } from "../Buttons/Button";
import { H2 } from "../App/H2";
import { BtnMinimizeAll } from "../Buttons/BtnMinimizeAll";
import { DndListWrapper } from "../App/DndListWrapper";

type ReviewListProps = {
  reviews: Review[];
  isEdit?: boolean;
};

export const ReviewList: FC<ReviewListProps> = ({ reviews, isEdit }) => {
  const {
    bookReview,
    updateBookReview,
    updateBookReviewEntity,
    onNavigateToEdit,
  } = useBookReview();
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

  function dragEndCallback(reviews: Review[]) {
    if (!bookReview) return;
    updateBookReview({ ...bookReview, reviews });
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
          <Button onClick={handleAddReview}>{t("btnAdd")}</Button>
        </div>
      </div>

      <DndListWrapper
        listClassName="flex flex-col gap-2"
        items={reviews}
        renderItem={review =>
          isEdit ? (
            <ReviewEdit review={review} />
          ) : (
            <ReviewDisplay review={review} />
          )
        }
        dragEndCallback={dragEndCallback}
      />
    </div>
  );
};
