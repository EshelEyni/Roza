import { FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { UseGetBookReviewsResult } from "../../types/app";
import { useLoginWithToken } from "../../hooks/reactQuery/get/useLoginWithToken";
import { getDefaultBookReview } from "../../services/bookReviewUtilService";
import { useAddBookReview } from "../../hooks/reactQuery/add/useAddBookReview";
import { ErrorMsg } from "../Msg/ErrorMsg";
import { EmptyMsg } from "../Msg/EmptyMsg";
import { BookLoader } from "../Loaders/BookLoader/BookLoader";
import { BookReviewPreview } from "./BookReviewPreview";
import { Button } from "../Buttons/Button";
import { AddEntityModal } from "../Modals/AddEntityModal";

type ReviewListProps = UseGetBookReviewsResult & {
  isHomePage?: boolean;
  paginationIdx?: number;
  intersectionRef?: React.MutableRefObject<null>;
};

export const BookReviewList: FC<ReviewListProps> = ({
  reviews,
  errorReviews,
  isLoadingReviews,
  isErrorReviews,
  isNoReviews,
  isHomePage = false,
  paginationIdx,
  intersectionRef,
}) => {
  const { loggedInUser } = useLoginWithToken();
  const [newBookReview, setNewBookReview] = useState(getDefaultBookReview());
  const { addBookReview } = useAddBookReview();
  const { t } = useTranslation();
  const navigate = useNavigate();

  function onGoToReviewsPage() {
    navigate("/reviews");
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setNewBookReview({ ...newBookReview, [e.target.name]: e.target.value });
  }

  function handleAddBook() {
    if (!newBookReview.name || !loggedInUser?.id) return;
    addBookReview({ ...newBookReview, userId: loggedInUser?.id });
    setNewBookReview(getDefaultBookReview());
  }

  return (
    <section className="w-full">
      <div className="flex items-center justify-between border-b border-app-800 bg-app-100 pb-1">
        <h3 className="w-fit text-3xl font-medium text-app-800">
          {t("reviews")}
        </h3>

        {!isHomePage && (
          <AddEntityModal
            title={t("btnAddReview")}
            defaultValue={newBookReview.name}
            handleInputChange={handleInputChange}
            onAddEntity={handleAddBook}
            placeholder={t("bookName")}
          />
        )}
      </div>
      {isErrorReviews && (
        <ErrorMsg
          msg={errorReviews instanceof Error ? errorReviews.message : ""}
        />
      )}
      {isNoReviews && <EmptyMsg msg={t("EmptyMsg.books")} />}

      {!!reviews && (
        <ul className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reviews.map(r => (
            <li key={r.id} className="flex-1">
              <BookReviewPreview review={r} />
            </li>
          ))}
        </ul>
      )}
      {isLoadingReviews && <BookLoader />}
      {!!reviews &&
        paginationIdx &&
        reviews.length >= paginationIdx * 12 &&
        !!intersectionRef && (
          <div ref={intersectionRef} className="h-12 w-full bg-transparent" />
        )}

      {isHomePage && (
        <div className="mt-3 flex items-center justify-end">
          <Button onClickFn={onGoToReviewsPage}>{t("seeAll.reviews")}</Button>
        </div>
      )}
    </section>
  );
};
