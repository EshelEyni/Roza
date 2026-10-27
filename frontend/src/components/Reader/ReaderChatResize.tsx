import { useTranslation } from "react-i18next";
import type { ReaderChatView } from "../../hooks/useReaderChat";
import { ReaderPanelResize } from "./ReaderPanelResize";

export function ReaderChatResize({ chat }: { chat: ReaderChatView }) {
  const { t } = useTranslation();
  return <ReaderPanelResize width={chat.workspace.panelWidth} onWidthChange={chat.setPanelWidth}
    minimumWidth={440} label={t("reader.chat.tabs.resize")} className="reader-chat-resize" />;
}
