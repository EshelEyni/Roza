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

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="w-3/4 max-w-96 rounded-lg bg-app-500 p-3">{children}</label>
);

export const EntityFilter: FC<EntityFilterProps> = ({
  sortOrder,
  searchTerm,
  sortField,
  onSort,
  handleInputChange,
}) => {
  const { t } = useTranslation();

  return (
    <div className="mb-4 flex w-full flex-col items-center justify-center gap-4 sm:flex-row">
      <Label>
        {t("sortBy")}:
        <select
          value={sortOrder}
          onChange={e => onSort(e.target.value)}
          className="ml-2 rounded-lg bg-app-500 p-1"
        >
          <option value={sortField}>{t("asc")}</option>
          <option value={`-${sortField}`}>{t("desc")}</option>
        </select>
      </Label>
      <Label>
        {t("search")}:
        <input
          type="text"
          defaultValue={searchTerm}
          onChange={debounce(e => handleInputChange(e), 500).debouncedFunc}
          className="ml-2 rounded-lg bg-app-500 p-1"
        />
      </Label>
    </div>
  );
};
