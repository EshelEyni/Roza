import { FC } from "react";
import { useUpdateBook } from "../../hooks/reactQuery/update/useUpdateBook";
import { Book, BookFilterBy } from "../../../../shared/types/books";
import { useTranslation } from "react-i18next";
import classNames from "classnames";

type BookDetailsFilterProps = {
  book: Book | null;
};

export const BookFilter: FC<BookDetailsFilterProps> = ({ book }) => {
  const tabs = [
    "chapters",
    "characters",
    "themes",
    "plotlines",
    "notes",
  ] as BookFilterBy[];

  const { updateBook } = useUpdateBook();
  const { t } = useTranslation();

  function handleFilterBy(tab: BookFilterBy) {
    if (!book) return;
    updateBook({ ...book, filterBy: tab });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map(tab => (
        <button
          key={tab}
          className={classNames(
            "rounded-md px-4 py-2",
            "focus:outline-none focus:ring-2 focus:ring-app-500 focus:ring-offset-2",
            {
              "bg-app-500 text-white": book?.filterBy === tab,
              "bg-white text-app-500": book?.filterBy !== tab,
            },
          )}
          onClick={() => handleFilterBy(tab)}
        >
          {t(`BookDetailsFilter.${tab}`)}
        </button>
      ))}
    </div>
  );
};
