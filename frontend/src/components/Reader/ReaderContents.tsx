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
  let active: NavItem | null = null;
  let activeDepth = -1;
  const findActive = (entries: NavItem[], depth = 0) => {
    for (const item of entries) {
      if (item.href === currentHref && depth >= activeDepth) { active = item; activeDepth = depth; }
      findActive(item.subitems || [], depth + 1);
    }
  };
  findActive(items);
  function renderItems(entries: NavItem[]) {
    return (
      <ol>
        {entries.map((item, index) => (
          <li key={item.id || item.href + index}>
            <button
              className={
                active === item
                  ? "is-active"
                  : ""
              }
              aria-current={active === item ? "location" : undefined}
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
