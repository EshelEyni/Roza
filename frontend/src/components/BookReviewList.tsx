import { FC, useState } from "react";
import { UseGetBookReviewsResult } from "../types/app";
import { useTranslation } from "react-i18next";
import { BookLoader } from "./BookLoader/BookLoader";
import { ErrorMsg } from "./ErrorMsg";
import { EmptyMsg } from "./EmptyMsg";
import { ReviewPreview } from "./ReviewPreview";
import { useNavigate } from "react-router-dom";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { useLoginWithToken } from "../hooks/reactQuery/get/useLoginWithToken";
import { getDefaultBookReview } from "../services/reviewUtilService";
import { useAddBookReview } from "../hooks/reactQuery/add/useAddReview";

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
          {t("ReviewsList.title")}
        </h3>

        {!isHomePage && (
          <Modal>
            <Modal.OpenBtn modalName="addReview">
              <div>{t("ReviewsList.btnAdd")}</div>
            </Modal.OpenBtn>

            <Modal.Window name="addReview">
              <div className="flex w-full flex-col gap-4">
                <h3 className="text-center text-2xl font-medium text-app-800">
                  {t("ReviewsList.btnAdd")}
                </h3>

                <div className="flex w-full flex-col gap-2">
                  <label htmlFor="name" className="text-lg text-app-800">
                    {t("ReviewsList.name")}
                  </label>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    defaultValue={newBookReview.name}
                    onChange={handleInputChange}
                    className="rounded-md border border-app-800 p-2"
                    placeholder={t("ReviewsList.name")}
                  />
                </div>

                <div className="mt-4 flex items-center justify-end">
                  <Button
                    onClickFn={handleAddBook}
                    className="rounded-md bg-app-600 px-4 py-2 text-white hover:bg-app-700"
                  >
                    {t("ReviewsList.btnAdd")}
                  </Button>
                </div>
              </div>
            </Modal.Window>
          </Modal>
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
              <ReviewPreview review={r} />
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
