import { FC } from "react";
import { Main } from "../../components/App/Main";
import { BookReviewList } from "../../components/BookReview/BookReviewList";
import { PageContent } from "../../components/App/PageContent";
import { useBookReviews } from "../../contexts/BookReviewsContext";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { EntityFilter } from "../../components/App/EntityFilter";

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
    onSearchReviews,
    onSortReviews,
    searchTerm,
    sortOrder,
  } = useBookReviews();

  return (
    <Main>
      <PageContent>
        <EntityFilter
          handleInputChange={onSearchReviews}
          onSort={onSortReviews}
          sortField="sortOrder"
          searchTerm={searchTerm}
          sortOrder={sortOrder}
        />
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
