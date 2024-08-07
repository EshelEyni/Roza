import { FC } from "react";
import { Main } from "../../components/Gen/Main";
import { PageContent } from "../../components/Gen/PageContent";
import { useBooks } from "../../contexts/BooksContext";
import { BookList } from "../../components/Book/BookList";
import { BooksFilter } from "./BooksFilter";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

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
  } = useBooks();

  return (
    <Main>
      <PageContent>
        <BooksFilter />
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
