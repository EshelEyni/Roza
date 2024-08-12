import { FC } from "react";
import { BooKDataItemType } from "../../../../shared/types/books";
import { useTranslation } from "react-i18next";
import classNames from "classnames";
import { useBook } from "../../contexts/BookContext";
import { Button } from "../Buttons/Button";

export const BookFilter: FC = () => {
  const { filterBy, onSetFilterBy } = useBook();
  const tabs = [
    "chapters",
    "characters",
    "themes",
    "plotlines",
    "notes",
  ] as BooKDataItemType[];

  const { t } = useTranslation();

  return (
    <section className="flex flex-wrap gap-3 sm:gap-2">
      {tabs.map(tab => (
        <Button
          key={tab}
          className={classNames(
            "rounded-md px-4 py-2 text-xl focus:outline-none focus:ring-2 focus:ring-app-500 focus:ring-offset-2 md:px-4 md:py-1 md:text-lg",
            {
              "bg-app-500 text-white": filterBy === tab,
              "bg-white text-app-500": filterBy !== tab,
            },
          )}
          onClick={() => onSetFilterBy(tab)}
        >
          {t(tab)}
        </Button>
      ))}
    </section>
  );
};
