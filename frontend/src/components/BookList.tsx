import { FC } from "react";
import { BookPreview } from "./BookPreview";
import { UseGetBooksResult as BookListProps } from "../types/app";
import { useTranslation } from "react-i18next";
import { BookLoader } from "./BookLoader/BookLoader";
import { ErrorMsg } from "./ErrorMsg";
import { EmptyMsg } from "./EmptyMsg";

export const BookList: FC<BookListProps> = ({
  books,
  errorBooks,
  isLoadingBooks,
  isErrorBooks,
  isEmpty,
  isBooksAvailable,
}) => {
  const { t } = useTranslation();

  return (
    <section className="w-full">
      <h3 className="w-fit border-b border-app-800 text-3xl font-medium text-app-800">
        {t("BookList.title")}
      </h3>
      {isLoadingBooks && <BookLoader />}
      {isErrorBooks && (
        <ErrorMsg msg={errorBooks instanceof Error ? errorBooks.message : ""} />
      )}
      {isEmpty && <EmptyMsg msg={t("EmptyMsg.books")} />}

      {isBooksAvailable && !!books && (
        <ul className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {books.map(book => (
            <li key={book.id}>
              <BookPreview book={book} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
