import { FC } from "react";
import { Review, SlateCustomElement } from "../../../../shared/types/books";
import { TextElement } from "../../components/TextElement";
import { useTranslation } from "react-i18next";
import { useLoginWithToken } from "../../hooks/reactQuery/get/useLoginWithToken";
import { formatDateByLang } from "../../services/utilService";

type ReviewListProps = {
  reviews: Review[];
};

export const ReviewList: FC<ReviewListProps> = ({ reviews }) => {
  const { loggedInUser } = useLoginWithToken();
  const { t } = useTranslation();
  return (
    <div className="w-full font-normal text-app-800">
      <h2 className="mb-2 text-2xl font-bold text-app-800">{t("reviews")}</h2>
      {reviews.map((review, idx) => {
        const parsedText = JSON.parse(review.text) as SlateCustomElement[];
        const formattedDate = review.createdAt
          ? formatDateByLang(review.createdAt, loggedInUser?.language || "en")
          : null;
        return (
          <div key={idx} className="flex flex-col gap-2">
            {parsedText.map((el, i) => (
              <TextElement key={i} element={el} />
            ))}

            <div className="mx-2 flex gap-1 italic text-app-600">
              <span>{t("createdAt")}:</span>
              <span>{formattedDate}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
