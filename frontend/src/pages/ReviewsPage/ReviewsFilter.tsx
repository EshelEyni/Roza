import { FC } from "react";
import { useReviews } from "../../contexts/ReviewsContext";
import { useTranslation } from "react-i18next";
import { debounce } from "../../services/utilService";

export const ReviewsFilter: FC = () => {
  const { sortOrder, searchTerm, onSortReviews, onSearchReviews } =
    useReviews();
  const { t } = useTranslation();

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const inputValue = e.target.value;
    onSearchReviews(!inputValue ? "" : inputValue);
  }

  return (
    <div className="mb-4 flex w-full items-center justify-center gap-8">
      <label className="mr-4 rounded-lg bg-app-500 p-2">
        {t("sortBy")}:
        <select
          value={sortOrder}
          onChange={e => onSortReviews(e.target.value as "asc" | "desc")}
          className="ml-2 rounded-lg bg-app-500 p-1"
        >
          <option value="sortOrder">{t("asc")}</option>
          <option value="-sortOrder">{t("desc")}</option>
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
