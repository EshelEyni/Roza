import { FC } from "react";
import { Main } from "../../components/App/Main";
import { PageContent } from "../../components/App/PageContent";
import { Loader } from "../../components/Loaders/Loader";
import { ErrorMsg } from "../../components/Msg/ErrorMsg";
import { useBook } from "../../contexts/BookContext";
import { BookFilter } from "../../components/Book/BookFilter";
import { Hr } from "../../components/App/Hr";
import { BookDataList } from "../../components/Book/BookDataList";
import { DataBookItemDetails } from "./DataBookItemDetails";
import { BookTitle } from "../../components/Book/BookTitle";
import { BtnAddBookItem } from "../../components/Book/BtnAddBookItem";
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

                <div className="flex flex-col items-start justify-between gap-8 sm:flex-row">
                  <BookFilter />
                  <BtnAddBookItem />
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
