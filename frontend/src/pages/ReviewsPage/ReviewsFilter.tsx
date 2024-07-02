import { FC } from "react";
import { useReviews } from "../../contexts/ReviewsContext";
import { useTranslation } from "react-i18next";

export const ReviewsFilter: FC = () => {
  const { sortOrder, searchKeyword, onSortReviews, onSearchReviews } =
    useReviews();
  const { t } = useTranslation();
  return (
    <div className="mb-4 flex w-full items-center justify-center gap-8">
      <label className="mr-4 rounded-lg bg-app-500 p-2">
        {t("ReviewsFilter.sortBy")}:
        <select
          value={sortOrder}
          onChange={e => onSortReviews(e.target.value as "asc" | "desc")}
          className="ml-2 rounded-lg bg-app-500 p-1"
        >
          <option value="asc">{t("ReviewsFilter.asc")}</option>
          <option value="desc">{t("ReviewsFilter.desc")}</option>
        </select>
      </label>
      <label className="rounded-lg bg-app-500 p-2">
        {t("ReviewsFilter.search")}:
        <input
          type="text"
          value={searchKeyword}
          onChange={e => onSearchReviews(e.target.value)}
          className="ml-2 rounded-lg bg-app-500 p-1"
        />
      </label>
    </div>
  );
};
