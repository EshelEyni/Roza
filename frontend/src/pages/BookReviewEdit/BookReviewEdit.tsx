import { FC } from "react";
import { useBookReview } from "../../contexts/ReviewContext";
import { Main } from "../../components/Gen/Main";
import { PageContent } from "../../components/Gen/PageContent";
import { Loader } from "../../components/Loaders/Loader";
import { ErrorMsg } from "../../components/Msg/ErrorMsg";
import { ReviewTitle } from "../../components/BookReview/Reviewtitle";
import { Hr } from "../../components/Gen/Hr";
import { ReviewList } from "../BookReviewDetails/ReviewList";
import { ReferenceList } from "../BookReviewDetails/ReferenceList";
import { StructureEdit } from "./StructureEdit";

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
            <ReviewTitle isEdit={true} />
            <Hr />

            <ReviewList reviews={bookReview.reviews} isEdit={true} />
            <Hr />
            <ReferenceList references={bookReview.references} isEdit={true} />
            <Hr />
            <StructureEdit structure={bookReview.structure} />
          </div>
        )}
      </PageContent>
    </Main>
  );
};

export default BookReviewEdit;
