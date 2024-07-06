import { FC, useState } from "react";
import { Main } from "../../components/Main";
import { PageContent } from "../../components/PageContent";
import { Loader } from "../../components/Loader";
import { ErrorMsg } from "../../components/ErrorMsg";
import { useBook } from "../../contexts/BookContext";
import { BookFilter } from "../../components/Book/BookFilter";
import { Hr } from "../../components/Hr";
import { useTranslation } from "react-i18next";
import { BookDataList } from "../../components/Book/BookDataList";
import { DisplayEditField } from "../../components/JobApplicationField";
import { useUpdateBook } from "../../hooks/reactQuery/update/useUpdateBook";
import { getDefaultBookDataItem } from "../../services/bookUtilService";
import { Button } from "../../components/Button";
import { Book, BookDataItem } from "../../../../shared/types/books";
import { DataBookItemDetails } from "./DataBookItemDetails";

const BookDetails: FC = () => {
  const [bookName, setBookName] = useState<string>("");
  const {
    book,
    errorBook,
    isErrorBook,
    isLoadingBook,
    isSuccessBook,
    dataItem,
    dataItemId,
  } = useBook();
  const { updateBook } = useUpdateBook(book?.filterBy);

  const filterBy = book?.filterBy || "chapters";
  const isDetailsBookShowing =
    isSuccessBook && book && !dataItem && !dataItemId;
  const isDataItemDetailsShowing =
    isSuccessBook &&
    book &&
    dataItem &&
    dataItemId &&
    (book[dataItem as keyof Book] as BookDataItem[]).find(
      i => i.id === dataItemId,
    );

  const { t } = useTranslation();

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setBookName(e.target.value);
  }

  function handleSaveClick() {
    if (!book || !bookName) return;
    updateBook({ ...book, name: bookName });
    setBookName("");
  }

  function handleAddBookDataItem() {
    if (!book) return;
    const type = book.filterBy;
    const newItem = getDefaultBookDataItem({ bookId: book.id, type });
    updateBook({ ...book, [type]: [...book[type], newItem] });
  }

  return (
    <Main>
      <PageContent>
        {isLoadingBook && <Loader />}
        {isErrorBook && (
          <ErrorMsg msg={errorBook instanceof Error ? errorBook.message : ""} />
        )}
        {isDetailsBookShowing && (
          <div className="flex w-full flex-col gap-1">
            <DisplayEditField>
              <div className="flex w-full items-center justify-between gap-4">
                <DisplayEditField.DisplayElement className="mb-4 text-4xl font-bold text-app-800">
                  <h1>{book.name}</h1>
                </DisplayEditField.DisplayElement>
                <DisplayEditField.EditButton className="rounded-md bg-app-500 px-4 py-2 text-white hover:bg-app-600">
                  <button>{t("BookPage.btnEdit")}</button>
                </DisplayEditField.EditButton>
              </div>

              <div className="flex w-full items-center justify-between gap-4">
                <DisplayEditField.EditElement
                  className="rounded-md border border-app-900 p-2 text-3xl font-bold text-app-800"
                  onChange={handleInputChange}
                >
                  <input type="text" defaultValue={book.name} />
                </DisplayEditField.EditElement>

                <DisplayEditField.SaveButton
                  onSubmit={handleSaveClick}
                  className="rounded-md bg-app-500 px-4 py-2 text-white hover:bg-app-600"
                >
                  <button>{t("BookPage.btnSave")}</button>
                </DisplayEditField.SaveButton>
              </div>
            </DisplayEditField>
            <Hr />

            <div className="flex flex-wrap items-center justify-between gap-8">
              <BookFilter book={book} />
              <Button
                className="rounded-md bg-app-500 px-4 py-2 text-white hover:bg-app-600"
                onClickFn={handleAddBookDataItem}
              >
                {t(`BookPage.btnAdd.${book.filterBy}`)}
              </Button>
            </div>
            <Hr />

            <BookDataList
              data={book.chapters}
              isRendered={filterBy === "chapters"}
              type="chapters"
            />

            <BookDataList
              data={book.characters}
              isRendered={filterBy === "characters"}
              type="characters"
            />

            <BookDataList
              data={book.themes}
              isRendered={filterBy === "themes"}
              type="themes"
            />

            <BookDataList
              data={book.plotlines}
              isRendered={filterBy === "plotlines"}
              type="plotlines"
            />

            <BookDataList
              data={book.notes}
              isRendered={filterBy === "notes"}
              type="notes"
            />
          </div>
        )}
        {isDataItemDetailsShowing && <DataBookItemDetails />}
      </PageContent>
    </Main>
  );
};

export default BookDetails;
