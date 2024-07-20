import { FC } from "react";
import { Main } from "../../components/Main";
import { ReviewList } from "../../components/ReviewList";
import { PageContent } from "../../components/PageContent";
import { useReviews } from "../../contexts/ReviewsContext";
import { ReviewsFilter } from "./ReviewsFilter";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

const ReviewsPage: FC = () => {
  useDocumentTitle("Roza / Reviews");

  const {
    filteredReviews,
    errorReviews,
    isLoadingReviews,
    isSuccessReviews,
    isErrorReviews,
    isNoReviews,
    isReviewsAvailable,
    paginationIdx,
    intersectionRef,
  } = useReviews();

  return (
    <Main>
      <PageContent>
        <ReviewsFilter />
        <ReviewList
          reviews={filteredReviews}
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
