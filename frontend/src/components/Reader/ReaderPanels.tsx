import { useEffect, useState } from "react";
import { ReaderWorkspace } from "./ReaderWorkspace";
import { ReaderPanelResize } from "./ReaderPanelResize";
import { useTranslation } from "react-i18next";
import { ReaderSheet } from "./ReaderSheet";
import { ReaderContents } from "./ReaderContents";
import { ReaderSearch } from "./ReaderSearch";
import { ReaderChat } from "./ReaderChat";
import { ReaderSettings } from "./ReaderSettings";
import type { EpubReaderController } from "../../hooks/reader/useEpubReader";
type Props = Pick<
  EpubReaderController,
  | "panel"
  | "closePanel"
  | "toc"
  | "href"
  | "onNavigate"
  | "loading"
  | "searchBook"
  | "locationsReady"
  | "onSearchNavigate"
  | "chat"
  | "state"
  | "updateState"
  | "publisherPagesAvailable"
>;
export function ReaderPanels({
  panel,
  closePanel,
  toc,
  href,
  onNavigate,
  loading,
  searchBook,
  locationsReady,
  onSearchNavigate,
  chat,
  state,
  updateState,
  publisherPagesAvailable,
}: Props) {
  const { t } = useTranslation();
  const [desktop, setDesktop] = useState(() => window.matchMedia("(min-width: 1100px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1100px)");
    const update = () => setDesktop(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  if (!panel) return null;
  return (
    <ReaderSheet
      mobileFullscreen={panel === "search" || panel === "chat"}
      mobileCloseInContent={panel === "search" || panel === "chat"}
      label={t(
        panel === "chat"
          ? "reader.chat.title"
          : panel === "contents"
            ? "reader.contents"
            : panel === "search"
              ? "reader.search"
              : "reader.settings",
      )}
      onClose={closePanel}
      className={"reader-resizable-panel " + (
        panel === "search"
          ? "reader-search-panel"
          : panel === "chat"
            ? (desktop ? "reader-groups-panel reader-chat-panel" : "reader-chat-panel")
            : ""
      )}
    >
      {panel !== "chat" && <ReaderPanelResize width={chat.workspace.panelWidth}
        onWidthChange={chat.setPanelWidth} />}
      {panel === "contents" ? (
        <ReaderContents
          items={toc}
          currentHref={href}
          onNavigate={onNavigate}
        />
      ) : panel === "search" ? (
        <ReaderSearch
          onClose={closePanel}
          book={loading ? null : searchBook}
          locationsReady={locationsReady}
          onNavigate={cfi => void onSearchNavigate(cfi)}
        />
      ) : panel === "chat" ? (
        desktop ? <ReaderWorkspace chat={chat} onClose={closePanel} /> : <ReaderChat chat={chat} onClose={closePanel} />
      ) : (
        <ReaderSettings
          preferences={state.preferences}
          publisherPagesAvailable={publisherPagesAvailable}
          onChange={preferences => updateState({ preferences })}
        />
      )}
    </ReaderSheet>
  );
}
