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
import { H2 } from "../App/H2";
import { GridList } from "../App/GridList";
import { GridListItem } from "../App/GridListItem";
import { EntityListTitleContainer } from "../App/EntityListTitleContainer";

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
      <EntityListTitleContainer>
        <H2>{t("books")}</H2>
        {!isHomePage && (
          <AddEntityModal
            title={t("btnAddBook")}
            defaultValue={newBook.name}
            handleInputChange={handleInputChange}
            onAddEntity={handleAddBook}
            placeholder={t("bookName")}
          />
        )}
      </EntityListTitleContainer>
      {isErrorBooks && (
        <ErrorMsg msg={errorBooks instanceof Error ? errorBooks.message : ""} />
      )}
      {isNoBooks && <EmptyMsg msg={t("EmptyMsg.books")} />}

      {!!books && (
        <GridList>
          {books.map(b => (
            <GridListItem key={b.id}>
              <BookPreview book={b} />
            </GridListItem>
          ))}
        </GridList>
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
          <Button onClick={onGoToBooksPage}>{t("seeAll.books")}</Button>
        </div>
      )}
    </section>
  );
};
