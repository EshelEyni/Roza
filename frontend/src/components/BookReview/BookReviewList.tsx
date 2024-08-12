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
import { GridList } from "../App/GridList";
import { GridListItem } from "../App/GridListItem";
import { H2 } from "../App/H2";
import { EntityListTitleContainer } from "../App/EntityListTitleContainer";

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
      <EntityListTitleContainer>
        <H2>{t("reviews")}</H2>

        {!isHomePage && (
          <AddEntityModal
            title={t("btnAddReview")}
            defaultValue={newBookReview.name}
            handleInputChange={handleInputChange}
            onAddEntity={handleAddBook}
            placeholder={t("bookName")}
          />
        )}
      </EntityListTitleContainer>
      {isErrorReviews && (
        <ErrorMsg
          msg={errorReviews instanceof Error ? errorReviews.message : ""}
        />
      )}
      {isNoReviews && <EmptyMsg msg={t("EmptyMsg.books")} />}

      {!!reviews && (
        <GridList>
          {reviews.map(r => (
            <GridListItem key={r.id}>
              <BookReviewPreview review={r} />
            </GridListItem>
          ))}
        </GridList>
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
          <Button onClick={onGoToReviewsPage}>{t("seeAll.reviews")}</Button>
        </div>
      )}
    </section>
  );
};
