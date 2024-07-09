import { FC } from "react";
import { useBook } from "../../contexts/BookContext";
import { Main } from "../../components/Main";
import { PageContent } from "../../components/PageContent";
import { Loader } from "../../components/Loader";
import { ErrorMsg } from "../../components/ErrorMsg";
import { BookTitle } from "../../components/Book/BookTitle";
import { Hr } from "../../components/Hr";
import { BookFilter } from "../../components/Book/BookFilter";
import { BtnAddBook } from "../../components/Book/btnAddBook";
import { BookDataList } from "../../components/Book/BookDataList";
import { DataBookItemEdit } from "./DataBookItemEdit";

const BookEdit: FC = () => {
  const {
    book,
    errorBook,
    isErrorBook,
    isLoadingBook,
    filterBy,
    isDetailsBookShowing,
    isDataItemDetailsShowing,
    bookDataItemTypes,
  } = useBook();
  console.log(book);
  return (
    <Main>
      <PageContent>
        {isLoadingBook && <Loader />}
        {isErrorBook && (
          <ErrorMsg msg={errorBook instanceof Error ? errorBook.message : ""} />
        )}
        {isDetailsBookShowing && !!book && (
          <div className="flex w-full flex-col gap-1">
            <BookTitle isBookEdit={true} />
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
                isBookEdit={true}
              />
            ))}
          </div>
        )}
        {isDataItemDetailsShowing && <DataBookItemEdit />}
      </PageContent>
    </Main>
  );
};

export default BookEdit;
