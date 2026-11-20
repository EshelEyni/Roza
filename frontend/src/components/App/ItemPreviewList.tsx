import { FC } from "react";
import { useTranslation } from "react-i18next";

type ItemPreviewListProps = {
  list: { label: string; value: string | number | null }[];
  className?: string;
};

export const ItemPreviewList: FC<ItemPreviewListProps> = ({
  list,
  className = "ui-preview-list",
}) => {
  const { t } = useTranslation();
  return (
    <ul className={className}>
      {list.map(item => (
        <li
          key={item.label}
        >
          <span>{t(item.label)}:</span>
          <span>{item.value}</span>
        </li>
      ))}
    </ul>
  );
};
