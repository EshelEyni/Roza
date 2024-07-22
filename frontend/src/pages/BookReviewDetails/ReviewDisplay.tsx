import { FC } from "react";
import { Review, SlateCustomElement } from "../../../../shared/types/books";
import { formatDateByLang } from "../../services/utilService";
import { useLoginWithToken } from "../../hooks/reactQuery/get/useLoginWithToken";
import { TextElement } from "../../components/TextElement";
import { useTranslation } from "react-i18next";

type ReviewDisplayProps = {
  review: Review;
};

export const ReviewDisplay: FC<ReviewDisplayProps> = ({ review }) => {
  const { loggedInUser } = useLoginWithToken();

  const parsedText = JSON.parse(review.text) as SlateCustomElement[];
  const formattedDate = review.createdAt
    ? formatDateByLang(review.createdAt, loggedInUser?.language || "en")
    : null;

  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2">
      {parsedText.map((el, i) => (
        <TextElement key={i} element={el} />
      ))}

      <div className="mx-2 flex gap-1 italic text-app-600">
        <span>{t("createdAt")}:</span>
        <span>{formattedDate}</span>
      </div>
    </div>
  );
};
