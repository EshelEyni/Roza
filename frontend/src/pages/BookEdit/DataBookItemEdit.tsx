import { FC } from "react";
import { useBook } from "../../contexts/BookContext";
import { Hr } from "../../components/Hr";
import {
  isChapterType,
  isNoteType,
} from "../../../../shared/services/utilService";
import { BookItemTitle } from "../../components/Book/BookItemTitle";
import { debounce } from "../../services/utilService";
import { useUpdateBook } from "../../hooks/reactQuery/update/useUpdateBook";
import { SlateEditor } from "../../components/SlateTextEditor/TextEditor";
import { Book } from "../../../../shared/types/books";

export const DataBookItemEdit: FC = () => {
  const { book, dataItemType, dataItemId, item, itemTitle, text, chatperText } =
    useBook();

  const { updateBook } = useUpdateBook();

  function handleNameInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!book || !dataItemType || !dataItemId || !item) return;
    const name = e.target.value;
    handleDataItemFieldUpdate({
      dataItemType: dataItemType as keyof Book,
      dataItemId,
      field: "name",
      value: name,
    });
  }

  function handleDataItemFieldUpdate({
    dataItemType,
    dataItemId,
    field,
    value,
  }: {
    dataItemType: keyof Book;
    dataItemId: string;
    field: string;
    value: string;
  }) {
    if (
      !book ||
      !dataItemType ||
      !dataItemId ||
      !Array.isArray(book[dataItemType]) ||
      !item
    )
      return;

    const newBook = { ...book };
    switch (dataItemType) {
      case "chapters":
        newBook.chapters = book.chapters.map(chapter =>
          chapter.id === dataItemId ? { ...chapter, [field]: value } : chapter,
        );
        break;
      case "characters":
        newBook.characters = book.characters.map(character =>
          character.id === dataItemId
            ? { ...character, [field]: value }
            : character,
        );
        break;
      case "themes":
        newBook.themes = book.themes.map(theme =>
          theme.id === dataItemId ? { ...theme, [field]: value } : theme,
        );
        break;
      case "plotlines":
        newBook.plotlines = book.plotlines.map(plotline =>
          plotline.id === dataItemId
            ? { ...plotline, [field]: value }
            : plotline,
        );
        break;
      case "notes":
        newBook.notes = book.notes.map(note =>
          note.id === dataItemId ? { ...note, [field]: value } : note,
        );
        break;
    }
    updateBook(newBook);
  }

  if (!book || !dataItemType || !dataItemId || !item) return null;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4">
      <BookItemTitle />
      <Hr />
      <div className="flex w-full items-center justify-between gap-4">
        {isNoteType(item) ? (
          <h1 className="text-4xl font-bold text-app-800">{itemTitle}</h1>
        ) : (
          <input
            type="text"
            className="w-full rounded-md border border-app-900 bg-gray-50 px-4 py-2 text-3xl font-bold text-app-700"
            onChange={
              debounce(e => handleNameInputChange(e), 500).debouncedFunc
            }
            defaultValue={itemTitle}
          />
        )}
      </div>
      <Hr />
      <SlateEditor
        defaultValue={[
          {
            type: "paragraph",
            children: [{ text: text }],
          },
        ]}
        onChange={newValue => {
          console.log("newValue", newValue);
        }}
      />

      {isChapterType(item) && (
        <>
          <Hr />
          <p className="w-full text-lg font-normal text-app-800">
            {chatperText}
          </p>
        </>
      )}
    </div>
  );
};