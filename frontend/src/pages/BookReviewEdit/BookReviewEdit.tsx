import { FC } from "react";
import { useBookReview } from "../../contexts/ReviewContext";
import { Main } from "../../components/Main";
import { PageContent } from "../../components/PageContent";
import { Loader } from "../../components/Loader";
import { ErrorMsg } from "../../components/ErrorMsg";
import { Reviewtitle } from "../../components/Reviewtitle";
import { Hr } from "../../components/Hr";
import { ReviewList } from "../BookReviewDetails/ReviewList";

const BookReviewEdit: FC = () => {
  const {
    bookReview,
    errorBookReview,
    isLoadingBookReview,
    isSuccessBookReview,
    isErrorBookReview,
  } = useBookReview();

  return (
    <Main>
      <PageContent>
        {isLoadingBookReview && <Loader />}
        {isErrorBookReview && (
          <ErrorMsg
            msg={
              errorBookReview instanceof Error ? errorBookReview.message : ""
            }
          />
        )}
        {isSuccessBookReview && !!bookReview && (
          <div className="flex w-full flex-col gap-1">
            <Reviewtitle isEdit={true} />
            <Hr />

            <ReviewList reviews={bookReview.reviews} isEdit={true} />
          </div>
        )}
      </PageContent>
    </Main>
  );
};

export default BookReviewEdit;
