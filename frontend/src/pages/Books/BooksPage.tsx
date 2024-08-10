import { FC } from "react";
import { Main } from "../../components/App/Main";
import { PageContent } from "../../components/App/PageContent";
import { useBooks } from "../../contexts/BooksContext";
import { BookList } from "../../components/Book/BookList";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { EntityFilter } from "../../components/App/EntityFilter";

const BooksPage: FC = () => {
  useDocumentTitle("Roza / Books");

  const {
    books,
    errorBooks,
    isLoadingBooks,
    isSuccessBooks,
    isErrorBooks,
    isNoBooks,
    isBooksAvailable,
    paginationIdx,
    intersectionRef,
    searchTerm,
    sortOrder,
    onSortBooks,
    onSearchBooks,
  } = useBooks();

  return (
    <Main>
      <PageContent>
        <EntityFilter
          handleInputChange={onSearchBooks}
          onSort={onSortBooks}
          sortField="createdAt"
          searchTerm={searchTerm}
          sortOrder={sortOrder}
        />
        <BookList
          books={books}
          errorBooks={errorBooks}
          isLoadingBooks={isLoadingBooks}
          isSuccessBooks={isSuccessBooks}
          isErrorBooks={isErrorBooks}
          isNoBooks={isNoBooks}
          isBooksAvailable={isBooksAvailable}
          paginationIdx={paginationIdx}
          intersectionRef={intersectionRef}
        />
      </PageContent>
    </Main>
  );
};

export default BooksPage;
