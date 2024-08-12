import { FC } from "react";
import { useTranslation } from "react-i18next";

type ItemPreviewListProps = {
  list: { label: string; value: string | number | null }[];
  className?: string;
};

export const ItemPreviewList: FC<ItemPreviewListProps> = ({
  list,
  className = "flex flex-col gap-1 text-sm",
}) => {
  const { t } = useTranslation();
  return (
    <ul className={className}>
      {list.map(item => (
        <li
          key={item.label}
          className="flex flex-wrap gap-1 text-xl text-app-700 md:text-lg"
        >
          <span>{t(item.label)}:</span>
          <span>{item.value}</span>
        </li>
      ))}
    </ul>
  );
};
