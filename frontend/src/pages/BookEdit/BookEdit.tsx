import { FC } from "react";
import { useBook } from "../../contexts/BookContext";
import { Main } from "../../components/Gen/Main";
import { PageContent } from "../../components/Gen/PageContent";
import { Loader } from "../../components/Loaders/Loader";
import { ErrorMsg } from "../../components/Msg/ErrorMsg";
import { BookTitle } from "../../components/Book/BookTitle";
import { Hr } from "../../components/Gen/Hr";
import { BookFilter } from "../../components/Book/BookFilter";
import { BtnAddBookItem } from "../../components/Book/BtnAddBookItem";
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

  return (
    <Main>
      <PageContent>
        {isLoadingBook && <Loader />}
        {isErrorBook && (
          <ErrorMsg msg={errorBook instanceof Error ? errorBook.message : ""} />
        )}
        {isDetailsBookShowing && !!book && (
          <div className="flex w-full flex-col gap-1">
            <BookTitle isEdit={true} />
            <Hr />

            <div className="flex flex-wrap items-center justify-between gap-8">
              <BookFilter />
              <BtnAddBookItem />
            </div>
            <Hr />
            {bookDataItemTypes.map(type => (
              <BookDataList
                key={type}
                isRendered={filterBy === type}
                type={type}
                isEdit={true}
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
