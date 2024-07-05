import { FC, useState } from "react";
import { BookPreview } from "./BookPreview";
import { UseGetBooksResult } from "../types/app";
import { useTranslation } from "react-i18next";
import { BookLoader } from "./BookLoader/BookLoader";
import { ErrorMsg } from "./ErrorMsg";
import { EmptyMsg } from "./EmptyMsg";
import { useNavigate } from "react-router-dom";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { getDefaultBook } from "../services/bookUtilService";
import { useLoginWithToken } from "../hooks/reactQuery/get/useLoginWithToken";
import { useAddBook } from "../hooks/reactQuery/add/useAddBook";

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
          {t("BookList.title")}
        </h3>
        {!isHomePage && (
          <Modal>
            <Modal.OpenBtn
              className="cursor-pointer rounded-md bg-app-600 px-3 py-1 text-white hover:bg-app-700"
              modalName="addBook"
            >
              <div>{t("BookList.btnAdd")}</div>
            </Modal.OpenBtn>

            <Modal.Window
              name="addBook"
              className="fixed left-1/2 top-1/2 z-[150] flex min-w-[300px] -translate-x-1/2 -translate-y-1/2 transform flex-col items-center gap-12 overflow-auto rounded-lg bg-app-100 p-4 shadow-lg md:min-w-[400px]"
            >
              <div className="flex w-full flex-col gap-4">
                <h3 className="text-center text-2xl font-medium text-app-800">
                  {t("BookList.btnAdd")}
                </h3>

                <div className="flex w-full flex-col gap-2">
                  <label htmlFor="name" className="text-lg text-app-800">
                    {t("BookList.name")}
                  </label>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    defaultValue={newBook.name}
                    onChange={handleInputChange}
                    className="rounded-md border border-app-800 p-2"
                    placeholder={t("BookList.name")}
                  />
                </div>

                <div className="mt-4 flex items-center justify-end">
                  <Button
                    onClickFn={handleAddBook}
                    className="rounded-md bg-app-600 px-4 py-2 text-white hover:bg-app-700"
                  >
                    {t("BookList.btnAdd")}
                  </Button>
                </div>
              </div>
            </Modal.Window>
          </Modal>
        )}
      </div>
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
