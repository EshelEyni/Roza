import { FC } from "react";
import { Main } from "../../components/Gen/Main";
import { BookReviewList } from "../../components/BookReview/BookReviewList";
import { PageContent } from "../../components/Gen/PageContent";
import { useBookReviews } from "../../contexts/BookReviewsContext";
import { ReviewsFilter } from "./BookReviewsFilter";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

const ReviewsPage: FC = () => {
  useDocumentTitle("Roza / Reviews");

  const {
    reviews,
    errorReviews,
    isLoadingReviews,
    isSuccessReviews,
    isErrorReviews,
    isNoReviews,
    isReviewsAvailable,
    paginationIdx,
    intersectionRef,
  } = useBookReviews();

  return (
    <Main>
      <PageContent>
        <ReviewsFilter />
        <BookReviewList
          reviews={reviews}
          errorReviews={errorReviews}
          isLoadingReviews={isLoadingReviews}
          isSuccessReviews={isSuccessReviews}
          isErrorReviews={isErrorReviews}
          isNoReviews={isNoReviews}
          isReviewsAvailable={isReviewsAvailable}
          paginationIdx={paginationIdx}
          intersectionRef={intersectionRef}
        />
      </PageContent>
    </Main>
  );
};

export default ReviewsPage;
