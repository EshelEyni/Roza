import { FC } from "react";
import { useBookReview } from "../../contexts/ReviewContext";
import { Main } from "../../components/Gen/Main";
import { PageContent } from "../../components/Gen/PageContent";
import { Loader } from "../../components/Loaders/Loader";
import { ErrorMsg } from "../../components/Msg/ErrorMsg";
import { ReviewTitle } from "../../components/BookReview/Reviewtitle";
import { Hr } from "../../components/Gen/Hr";
import { ReviewList } from "../../components/BookReview/ReviewList";

const BookReviewDetails: FC = () => {
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
            <ReviewTitle />
            <Hr />

            <ReviewList reviews={bookReview.reviews} />
          </div>
        )}
      </PageContent>
    </Main>
  );
};

export default BookReviewDetails;
