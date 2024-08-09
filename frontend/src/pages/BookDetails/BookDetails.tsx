import { FC } from "react";
import { Main } from "../../components/Gen/Main";
import { PageContent } from "../../components/Gen/PageContent";
import { Loader } from "../../components/Loaders/Loader";
import { ErrorMsg } from "../../components/Msg/ErrorMsg";
import { useBook } from "../../contexts/BookContext";
import { BookFilter } from "../../components/Book/BookFilter";
import { Hr } from "../../components/Gen/Hr";
import { BookDataList } from "../../components/Book/BookDataList";
import { DataBookItemDetails } from "./DataBookItemDetails";
import { BookTitle } from "../../components/Book/BookTitle";
import { BtnAddBook } from "../../components/Book/BtnAddBook";
import { ReadMode } from "./ReadMode";

const BookDetails: FC = () => {
  const {
    book,
    errorBook,
    isErrorBook,
    isLoadingBook,
    filterBy,
    isDetailsBookShowing,
    isDataItemDetailsShowing,
    isReadMode,
    bookDataItemTypes,
  } = useBook();

  return (
    <Main>
      <PageContent>
        {isLoadingBook && <Loader />}
        {isErrorBook && (
          <ErrorMsg msg={errorBook instanceof Error ? errorBook.message : ""} />
        )}
        {isReadMode && <ReadMode />}
        {!isReadMode && (
          <>
            {isDetailsBookShowing && !!book && (
              <div className="flex w-full flex-col gap-1">
                <BookTitle />
                <Hr />

                <div className="flex flex-wrap items-center justify-between gap-8">
                  <BookFilter />
                  <BtnAddBook />
                </div>
                <Hr />

                {bookDataItemTypes.map(type => (
                  <BookDataList
                    key={type}
                    isRendered={filterBy === type}
                    type={type}
                  />
                ))}
              </div>
            )}
            {isDataItemDetailsShowing && <DataBookItemDetails />}
          </>
        )}
      </PageContent>
    </Main>
  );
};

export default BookDetails;
