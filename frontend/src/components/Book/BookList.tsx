import { FC, useState } from "react";
import { BookPreview } from "./BookPreview";
import { UseGetBooksResult } from "../../types/app";
import { useTranslation } from "react-i18next";
import { BookLoader } from "../Loaders/BookLoader/BookLoader";
import { ErrorMsg } from "../Msg/ErrorMsg";
import { EmptyMsg } from "../Msg/EmptyMsg";
import { useNavigate } from "react-router-dom";
import { Button } from "../Buttons/Button";
import { getDefaultBook } from "../../services/bookUtilService";
import { useLoginWithToken } from "../../hooks/reactQuery/get/useLoginWithToken";
import { useAddBook } from "../../hooks/reactQuery/add/useAddBook";
import { AddEntityModal } from "../Modals/AddEntityModal";

type BookListProps = UseGetBooksResult & {
  isHomePage?: boolean;
  paginationIdx?: number;
  intersectionRef?: React.MutableRefObject<null>;
};

export const BookList: FC<BookListProps> = ({
  books,
  errorBooks,
  isLoadingBooks,
  isErrorBooks,
  isNoBooks,
  isHomePage = false,
  paginationIdx,
  intersectionRef,
}) => {
  const { loggedInUser } = useLoginWithToken();
  const [newBook, setNewBook] = useState(getDefaultBook());
  const { addBook } = useAddBook();
  const { t } = useTranslation();
  const navigate = useNavigate();

  function onGoToBooksPage() {
    navigate("/books");
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setNewBook({ ...newBook, [e.target.name]: e.target.value });
  }

  function handleAddBook() {
    if (!newBook.name || !loggedInUser?.id) return;
    addBook({ ...newBook, userId: loggedInUser?.id });
    setNewBook(getDefaultBook());
  }
  return (
    <section className="w-full">
      <div className="flex items-center justify-between border-b border-app-800 bg-app-100 pb-1">
        <h3 className="w-fit text-3xl font-medium text-app-800">
          {t("books")}
        </h3>
        {!isHomePage && (
          <AddEntityModal
            title={t("btnAddBook")}
            defaultValue={newBook.name}
            handleInputChange={handleInputChange}
            onAddEntity={handleAddBook}
            placeholder={t("bookName")}
          />
        )}
      </div>
      {isErrorBooks && (
        <ErrorMsg msg={errorBooks instanceof Error ? errorBooks.message : ""} />
      )}
      {isNoBooks && <EmptyMsg msg={t("EmptyMsg.books")} />}

      {!!books && (
        <ul className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {books.map(b => (
            <li key={b.id}>
              <BookPreview book={b} />
            </li>
          ))}
        </ul>
      )}
      {isLoadingBooks && <BookLoader />}
      {!!books &&
        paginationIdx &&
        books.length >= paginationIdx * 12 &&
        !!intersectionRef && (
          <div ref={intersectionRef} className="h-12 w-full bg-transparent" />
        )}

      {isHomePage && (
        <div className="mt-3 flex items-center justify-end">
          <Button onClickFn={onGoToBooksPage}>{t("seeAll.books")}</Button>
        </div>
      )}
    </section>
  );
};
