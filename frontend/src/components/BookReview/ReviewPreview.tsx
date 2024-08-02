import { FC } from "react";
import { BookReview } from "../../../../shared/types/books";
import { useLoginWithToken } from "../../hooks/reactQuery/get/useLoginWithToken";
import { useTranslation } from "react-i18next";
import { formatDateByLang } from "../../services/utilService";
import { useNavigate } from "react-router-dom";
import { H2 } from "../Gen/H2";

type ReviewPreviewProps = {
  review: BookReview;
};

export const ReviewPreview: FC<ReviewPreviewProps> = ({ review }) => {
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
    <article
      className="h-full cursor-pointer rounded-lg border border-app-800 bg-app-100 p-2 shadow-lg transition duration-300 hover:scale-105 hover:shadow-xl"
      onClick={handlePreviewClick}
    >
      <H2>{review.name}</H2>
      <ul className="flex flex-col gap-1 text-sm">
        <li className="flex gap-1 text-app-600">
          <span>{t("ReviewPreview.reviews")}:</span>
          <span>{review.reviews.length}</span>
        </li>
        <li className="flex gap-1 text-app-600">
          <span>{t("ReviewPreview.references")}:</span>
          <span>{review.references.length}</span>
        </li>
        <li className="flex flex-wrap gap-1 text-app-600">
          <span>{t("ReviewPreview.createdAt")}:</span>
          <span>{formattedDate}</span>
        </li>
      </ul>
    </article>
  );
};
