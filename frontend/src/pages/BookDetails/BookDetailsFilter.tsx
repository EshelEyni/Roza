import { FC } from "react";
import { useBook } from "../../contexts/BookContext";
import { useUpdateBook } from "../../hooks/reactQuery/update/useUpdateBook";
import { BookFilterBy } from "../../../../shared/types/books";
import { useTranslation } from "react-i18next";
import classNames from "classnames";

export const BookDetailsFilter: FC = () => {
  const { book } = useBook();
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
    <div>
      {tabs.map(tab => (
        <button
          key={tab}
          className={classNames(
            "mr-2 rounded-md px-4 py-2",
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
