import { FC } from "react";
import { BookPreview } from "./BookPreview";
import { UseGetBooksResult } from "../types/app";
import { useTranslation } from "react-i18next";
import { BookLoader } from "./BookLoader/BookLoader";
import { ErrorMsg } from "./ErrorMsg";
import { EmptyMsg } from "./EmptyMsg";
import { useNavigate } from "react-router-dom";
import { Button } from "./Button";

type BookListProps = UseGetBooksResult & {
  isHomePage?: boolean;
};

export const BookList: FC<BookListProps> = ({
  books,
  errorBooks,
  isLoadingBooks,
  isErrorBooks,
  isNoBooks,
  isBooksAvailable,
  isHomePage = false,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  function onGoToBooksPage() {
    navigate("/books");
  }
  return (
    <section className="w-full">
      <h3 className="w-fit border-b border-app-800 text-3xl font-medium text-app-800">
        {t("BookList.title")}
      </h3>
      {isLoadingBooks && <BookLoader />}
      {isErrorBooks && (
        <ErrorMsg msg={errorBooks instanceof Error ? errorBooks.message : ""} />
      )}
      {isNoBooks && <EmptyMsg msg={t("EmptyMsg.books")} />}

      {isBooksAvailable && !!books && (
        <ul className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {books.map(b => (
            <li key={b.id}>
              <BookPreview book={b} />
            </li>
          ))}
        </ul>
      )}
      {isHomePage && (
        <div className="mt-3 flex items-center justify-end">
          <Button
            onClickFn={onGoToBooksPage}
            className="rounded-md bg-app-600 px-4 py-2 text-white hover:bg-app-700"
          >
            {t("BookList.seeAll")}
          </Button>
        </div>
      )}
    </section>
  );
};