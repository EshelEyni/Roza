import { FC } from "react";
import { useBookReview } from "../../contexts/BookReviewContext";
import { Main } from "../../components/App/Main";
import { PageContent } from "../../components/App/PageContent";
import { Loader } from "../../components/Loaders/Loader";
import { ErrorMsg } from "../../components/Msg/ErrorMsg";
import { BookReviewTitle } from "../../components/BookReview/BookReviewtitle";
import { Hr } from "../../components/App/Hr";
import { ReviewList } from "../../components/BookReview/ReviewList";
import { ReferenceList } from "../../components/BookReview/ReferenceList";
import { StructureDisplay } from "../../components/BookReview/StructureDisplay";

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
            <BookReviewTitle />
            <Hr />

            <ReviewList reviews={bookReview.reviews} />
            <Hr />
            <ReferenceList references={bookReview.references} />
            <Hr />
            <StructureDisplay structure={bookReview.structure} />
          </div>
        )}
      </PageContent>
    </Main>
  );
};

export default BookReviewDetails;
