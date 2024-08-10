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
import { StructureEdit } from "../../components/BookReview/StructureEdit";

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
          <div className="flex w-full flex-col gap-2">
            <BookReviewTitle isEdit={true} />
            <Hr />

            <ReviewList reviews={bookReview.reviews} isEdit={true} />
            <ReferenceList references={bookReview.references} isEdit={true} />
            <StructureEdit structure={bookReview.structure} />
          </div>
        )}
      </PageContent>
    </Main>
  );
};

export default BookReviewEdit;
