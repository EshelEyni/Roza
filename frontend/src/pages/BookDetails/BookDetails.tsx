import { FC } from "react";
import { Main } from "../../components/Main";
import { PageContent } from "../../components/PageContent";
import { Loader } from "../../components/Loader";
import { ErrorMsg } from "../../components/ErrorMsg";
import { useBook } from "../../contexts/BookContext";
import { BookDetailsFilter } from "./BookDetailsFilter";
import { Hr } from "../../components/Hr";
import { Button } from "../../components/Button";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookDataList } from "../../components/Book/BookDataList";

const BookDetails: FC = () => {
  const { book, errorBook, isErrorBook, isLoadingBook, isSuccessBook } =
    useBook();

  const filterBy = book?.filterBy || "chapters";

  const { t } = useTranslation();
  const navigate = useNavigate();

  function handleBtnEditClick() {
    navigate(`/book-edit/${book?.id}`);
  }

  return (
    <Main>
      <PageContent>
        {isLoadingBook && <Loader />}
        {isErrorBook && (
          <ErrorMsg msg={errorBook instanceof Error ? errorBook.message : ""} />
        )}
        {isSuccessBook && book && (
          <div>
            <div className="flex w-full items-center justify-between gap-4 p-4">
              <h1 className="mb-4 text-4xl font-bold text-app-800">
                {book.name}
              </h1>
              <Button
                className="rounded-md bg-app-500 px-4 py-2 text-white hover:bg-app-600"
                onClickFn={handleBtnEditClick}
              >
                {t("BookDetails.btnEdit")}
              </Button>
            </div>
            <Hr />

            <BookDetailsFilter />
            <Hr />

            <BookDataList
              data={book.chapters}
              isRendered={filterBy === "chapters"}
              type="chapter"
            />

            <BookDataList
              data={book.characters}
              isRendered={filterBy === "characters"}
              type="character"
            />

            <BookDataList
              data={book.themes}
              isRendered={filterBy === "themes"}
              type="theme"
            />

            <BookDataList
              data={book.plotlines}
              isRendered={filterBy === "plotlines"}
              type="plotline"
            />

            <BookDataList
              data={book.notes}
              isRendered={filterBy === "notes"}
              type="note"
            />
          </div>
        )}
      </PageContent>
    </Main>
  );
};

export default BookDetails;
