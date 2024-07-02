import { FC } from "react";
import { UseGetBookReviewsResult } from "../types/app";
import { useTranslation } from "react-i18next";
import { BookLoader } from "./BookLoader/BookLoader";
import { ErrorMsg } from "./ErrorMsg";
import { EmptyMsg } from "./EmptyMsg";
import { ReviewPreview } from "./ReviewPreview";
import { useNavigate } from "react-router-dom";
import { Button } from "./Button";

type ReviewListProps = UseGetBookReviewsResult & {
  isHomePage?: boolean;
};

export const ReviewList: FC<ReviewListProps> = ({
  reviews,
  errorReviews,
  isLoadingReviews,
  isErrorReviews,
  isNoReviews,
  isReviewsAvailable,
  isHomePage = false,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  function onGoToReviewsPage() {
    navigate("/reviews");
  }

  return (
    <section className="w-full">
      <h3 className="w-fit border-b border-app-800 text-3xl font-medium text-app-800">
        {t("ReviewsList.title")}
      </h3>
      {isLoadingReviews && <BookLoader />}
      {isErrorReviews && (
        <ErrorMsg
          msg={errorReviews instanceof Error ? errorReviews.message : ""}
        />
      )}
      {isNoReviews && <EmptyMsg msg={t("EmptyMsg.books")} />}

      {isReviewsAvailable && !!reviews && (
        <ul className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reviews.map(r => (
            <li key={r.id} className="flex-1">
              <ReviewPreview review={r} />
            </li>
          ))}
        </ul>
      )}
      {isHomePage && (
        <div className="mt-3 flex items-center justify-end">
          <Button
            onClickFn={onGoToReviewsPage}
            className="rounded-md bg-app-600 px-4 py-2 text-white hover:bg-app-700"
          >
            {t("ReviewsList.seeAll")}
          </Button>
        </div>
      )}
    </section>
  );
};
