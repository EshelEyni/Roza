import { useTranslation } from "react-i18next";
import type { ConnectionInfo } from "../../../../../shared/types/stagingRoom";

export type Tab = "books" | "connection";

export function TopBar({
  tab,
  onTab,
  connection,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  connection?: ConnectionInfo;
}) {
  const { t } = useTranslation();

  return (
    <header className="topbar">
      <div className="brand">
        <img src="/images/icon-512X512.png" alt="" />
        <span className="brand-name">Roza</span>
        <span className="brand-sub" dir="auto">{t("stagingRoom.title")}</span>
      </div>
      <nav className="tabs">
        <button className={`tab ${tab === "books" ? "active" : ""}`} onClick={() => onTab("books")}>
          Books
        </button>
        <button className={`tab ${tab === "connection" ? "active" : ""}`} onClick={() => onTab("connection")}>
          Connection
        </button>
      </nav>
      <button className="db-pill" onClick={() => onTab("connection")} title={connection?.source}>
        <span className={`dot ${connection?.configured ? "on" : "off"}`} />
        {connection?.configured ? (
          <>
            <strong>{connection.dbName}</strong>
            <span className="muted">{connection.host}</span>
          </>
        ) : (
          <span>Not configured</span>
        )}
      </button>
    </header>
  );
}
