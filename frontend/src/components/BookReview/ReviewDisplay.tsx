import { FC } from "react";
import { Review } from "../../../../shared/types/books";
import { formatDateByLang } from "../../services/utilService";
import { useLoginWithToken } from "../../hooks/reactQuery/get/useLoginWithToken";
import { TextElement } from "../Gen/TextElement";
import { useTranslation } from "react-i18next";
import { useBookReview } from "../../contexts/ReviewContext";
import { MinimizedText } from "./MinimizedText";
import { BtnMinimize } from "../Buttons/BtnMinimize";
import { H3 } from "../Gen/H3";
import { useMinimized } from "../../hooks/useIsMinimized";

type ReviewDisplayProps = {
  review: Review;
  index: number;
};

export const ReviewDisplay: FC<ReviewDisplayProps> = ({ review, index }) => {
  const { loggedInUser } = useLoginWithToken();
  const { updateBookReviewEntity } = useBookReview();
  const { isMinimized, setIsMinimized } = useMinimized({
    isMinimizedProp: review.isMinimized,
  });

  const formattedDate = review.createdAt
    ? formatDateByLang(review.createdAt, loggedInUser?.language || "en")
    : null;

  const { t } = useTranslation();

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

        <BtnMinimize
          isMinimized={review.isMinimized}
          onToggleMinimize={onToggleMinimize}
          text={review.text}
        />
      </div>

      {isMinimized ? (
        <MinimizedText textEl={review.text} />
      ) : (
        <>
          {review.text.map((el, i) => (
            <TextElement key={i} element={el} />
          ))}
        </>
      )}

      <div className="mx-2 flex gap-1 italic text-app-600">
        <span>{t("createdAt")}:</span>
        <span>{formattedDate}</span>
      </div>
    </div>
  );
};
