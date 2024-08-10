import { FC } from "react";
import { BookReview } from "../../../../shared/types/books";
import { useLoginWithToken } from "../../hooks/reactQuery/get/useLoginWithToken";
import { useTranslation } from "react-i18next";
import { formatDateByLang } from "../../services/utilService";
import { useNavigate } from "react-router-dom";
import { Article } from "../App/Article";
import { H3 } from "../App/H3";

type ReviewPreviewProps = {
  review: BookReview;
};

export const BookReviewPreview: FC<ReviewPreviewProps> = ({ review }) => {
  const { loggedInUser } = useLoginWithToken();
  const { t } = useTranslation();
  const formattedDate = review.createdAt
    ? formatDateByLang(review.createdAt, loggedInUser?.language || "en")
    : null;

  const navigate = useNavigate();

  function handlePreviewClick() {
    navigate(`/review/${review.id}`);
  }

  return (
    <Article onClick={handlePreviewClick}>
      <H3>{review.name}</H3>
      <ul className="flex flex-col gap-1 text-sm">
        <li className="flex gap-1 text-app-600">
          <span>{t("reviews")}:</span>
          <span>{review.reviews.length}</span>
        </li>
        <li className="flex gap-1 text-app-600">
          <span>{t("references")}:</span>
          <span>{review.references.length}</span>
        </li>
        <li className="flex flex-wrap gap-1 text-app-600">
          <span>{t("createdAt")}:</span>
          <span>{formattedDate}</span>
        </li>
      </ul>
    </Article>
  );
};
