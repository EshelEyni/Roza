import { FC, useId } from "react";
import { useTranslation } from "react-i18next";
import { debounce } from "../../services/utilService";
import { ReaderSelect } from "../Reader/ReaderSelect";

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

  const id = useId();
  const sortId = id + "-sort";
  const sortLabelId = id + "-sort-label";
  const searchId = id + "-search";

  return (
    <div className="ui-filter">
      <div className="ui-filter-label">
        <span id={sortLabelId}>{t("sortBy")}:</span>
        <ReaderSelect
          id={sortId}
          labelId={sortLabelId}
          value={sortOrder}
          options={[
            { value: sortField, label: t("asc") },
            { value: `-${sortField}`, label: t("desc") },
          ]}
          onChange={onSort}
        />
      </div>
      <label className="ui-filter-label" htmlFor={searchId}>
        {t("search")}:
        <input
          id={searchId}
          type="text"
          defaultValue={searchTerm}
          onChange={debounce(e => handleInputChange(e), 1500).debouncedFunc}
          className="ui-input"
        />
      </label>
    </div>
  );
};
