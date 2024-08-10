import { FC } from "react";
import { useUpdateBook } from "../../hooks/reactQuery/update/useUpdateBook";
import { BooKDataItemType } from "../../../../shared/types/books";
import { useTranslation } from "react-i18next";
import classNames from "classnames";
import { useBook } from "../../contexts/BookContext";
import { Button } from "../Buttons/Button";

export const BookFilter: FC = () => {
  const { book } = useBook();
  const tabs = [
    "chapters",
    "characters",
    "themes",
    "plotlines",
    "notes",
  ] as BooKDataItemType[];

  const { updateBook } = useUpdateBook();
  const { t } = useTranslation();

  function handleFilterBy(tab: BooKDataItemType) {
    if (!book) return;
    updateBook({ ...book, filterBy: tab });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map(tab => (
        <Button
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
          {t(tab)}
        </Button>
      ))}
    </div>
  );
};
