import { FC } from "react";
import { Main } from "../../components/Main";
import { PageContent } from "../../components/PageContent";
import { useBooks } from "../../contexts/BooksContext";
import { BookList } from "../../components/BookList";
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
          intersectionRef={intersectionRef}
        />
      </PageContent>
    </Main>
  );
};

export default BooksPage;
