import { FC } from "react";
import { useBook } from "../../contexts/BookContext";
import { Hr } from "../../components/App/Hr";
import {
  isChapterType,
  isNoteType,
} from "../../../../shared/services/utilService";
import { BookItemTitle } from "../../components/Book/BookItemTitle";
import { debounce } from "../../services/utilService";
import { useUpdateBook } from "../../hooks/reactQuery/update/useUpdateBook";
import { SlateEditor } from "../../components/SlateTextEditor/SlateEditor";
import { Book, SlateCustomElement } from "../../../../shared/types/books";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/Buttons/Button";
import { H2 } from "../../components/App/H2";
import { Input } from "../../components/App/Input";
import { Header } from "../../components/App/Header";

export const DataBookItemEdit: FC = () => {
  const {
    book,
    dataItemType,
    dataItemId,
    item,
    itemTitle,
    textEl,
    chatperTextEl,
    onGoToDetails,
  } = useBook();
  const { updateBook } = useUpdateBook();
  const { t } = useTranslation();
  const { description, text } = {
    description: t("description"),
    text: t("text"),
  };

  const firstEditorTitle =
    (item && (isNoteType(item) ? text : description)) || "";

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
    value: string | SlateCustomElement[];
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

  function handleTextChange(text: SlateCustomElement[]) {
    if (!book || !dataItemType || !dataItemId || !item) return;

    const field = isNoteType(item) ? "text" : "description";

    handleDataItemFieldUpdate({
      dataItemType: dataItemType as keyof Book,
      dataItemId,
      field,
      value: text,
    });
  }

  function handleChapterTextChange(text: SlateCustomElement[]) {
    if (!book || !dataItemType || !dataItemId || !item) return;
    handleDataItemFieldUpdate({
      dataItemType: dataItemType as keyof Book,
      dataItemId,
      field: "text",
      value: text,
    });
  }

  if (!book || !dataItemType || !dataItemId || !item) return null;

  return (
    <section className="flex h-full w-full flex-col justify-center gap-4">
      <BookItemTitle />
      <Hr />
      <Header>
        {isNoteType(item) ? (
          <h1 className="text-4xl font-bold text-app-800">{itemTitle}</h1>
        ) : (
          <Input
            type="text"
            onChange={
              debounce(e => handleNameInputChange(e), 500).debouncedFunc
            }
            defaultValue={item.name && itemTitle}
          />
        )}
      </Header>
      <Hr />

      <H2>{firstEditorTitle}</H2>
      <SlateEditor
        initialValue={textEl}
        onChange={debounce(value => handleTextChange(value), 500).debouncedFunc}
        fullScreenTitle={book.name || t("book")}
      />

      {isChapterType(item) && (
        <>
          <Hr />
          <H2>{text}</H2>
          <SlateEditor
            initialValue={chatperTextEl}
            onChange={
              debounce(value => handleChapterTextChange(value), 500)
                .debouncedFunc
            }
            fullScreenTitle={book.name || t("book")}
          />
        </>
      )}

      <Hr />
      <div className="flex w-full items-center justify-end gap-4 bg-app-100">
        <Button onClick={onGoToDetails}>{t("goToDetails")}</Button>
      </div>
    </section>
  );
};
