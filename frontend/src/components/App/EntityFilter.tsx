import { FC } from "react";
import { useTranslation } from "react-i18next";
import { debounce } from "../../services/utilService";

type EntityFilterProps = {
  sortOrder: string;
  searchTerm: string;
  sortField: string;
  onSort: (sortOrder: string) => void;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export const EntityFilter: FC<EntityFilterProps> = ({
  sortOrder,
  searchTerm,
  sortField,
  onSort,
  handleInputChange,
}) => {
  const { t } = useTranslation();

  return (
    <div className="mb-4 flex w-full items-center justify-center gap-8">
      <label className="mr-4 rounded-lg bg-app-500 p-2">
        {t("sortBy")}:
        <select
          value={sortOrder}
          onChange={e => onSort(e.target.value)}
          className="ml-2 rounded-lg bg-app-500 p-1"
        >
          <option value={sortField}>{t("asc")}</option>
          <option value={`-${sortField}`}>{t("desc")}</option>
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
