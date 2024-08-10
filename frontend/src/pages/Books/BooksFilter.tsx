import { FC } from "react";
import { useTranslation } from "react-i18next";
import { useBooks } from "../../contexts/BooksContext";
import { debounce } from "../../services/utilService";

export const BooksFilter: FC = () => {
  const { sortOrder, searchTerm, onSortBooks, onSearchBooks } = useBooks();
  const { t } = useTranslation();

  async function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const inputValue = e.target.value;
    onSearchBooks(!inputValue ? "" : inputValue);
  }

  return (
    <div className="mb-4 flex w-full items-center justify-center gap-8">
      <label className="mr-4 rounded-lg bg-app-500 p-2">
        {t("sortBy")}:
        <select
          value={sortOrder}
          onChange={e => onSortBooks(e.target.value)}
          className="ml-2 rounded-lg bg-app-500 p-1"
        >
          <option value="createdAt">{t("asc")}</option>
          <option value="-createdAt">{t("desc")}</option>
        </select>
      </label>
      <label className="rounded-lg bg-app-500 p-2">
        {t("search")}:
        <input
          type="text"
          defaultValue={searchTerm}
          onChange={debounce(e => handleInputChange(e), 500).debouncedFunc}
          className="ml-2 rounded-lg bg-app-500 p-1"
        />
      </label>
    </div>
  );
};
