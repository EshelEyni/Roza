import { NavItem } from "epubjs";
import { useTranslation } from "react-i18next";

export function ReaderContents({
  items,
  currentHref,
  onNavigate,
}: {
  items: NavItem[];
  currentHref: string;
  onNavigate: (href: string) => void;
}) {
  const { t } = useTranslation();
  function renderItems(entries: NavItem[]) {
    return (
      <ol>
        {entries.map((item, index) => (
          <li key={item.id || item.href + index}>
            <button
              className={
                currentHref === item.href
                  ? "is-active"
                  : ""
              }
              onClick={() => onNavigate(item.href)}
            >
              {item.label.trim()}
            </button>
            {!!item.subitems?.length && renderItems(item.subitems)}
          </li>
        ))}
      </ol>
    );
  }
  return (
    <nav className="reader-contents" aria-label={t("reader.contents")}>
      <h2>{t("reader.contents")}</h2>
      {items.length ? renderItems(items) : <p>{t("reader.noContents")}</p>}
    </nav>
  );
}
