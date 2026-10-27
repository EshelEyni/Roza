import { useCallback, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { useReaderChat } from "../../hooks/useReaderChat";

export function ReaderChatResize({ chat }: { chat: ReturnType<typeof useReaderChat> }) {
  const { t } = useTranslation();
  const handle = useRef<HTMLDivElement>(null);
  const drag = useRef<{ right: number; width: number }>();
  const panel = useCallback(() => handle.current?.closest<HTMLElement>(".reader-chat-panel"), []);
  const clamp = useCallback((width: number) => Math.max(440, Math.min(760, (panel()?.parentElement?.clientWidth || window.innerWidth) - 480, width)), [panel]);
  const preview = useCallback((width: number) => { panel()?.style.setProperty("--reader-chat-panel-width", clamp(width) + "px"); }, [panel, clamp]);
  useLayoutEffect(() => { preview(chat.workspace.panelWidth); }, [chat.workspace.panelWidth, preview]);
  return <div ref={handle} className="reader-chat-resize" role="separator" tabIndex={0}
    aria-label={t("reader.chat.tabs.resize")} aria-orientation="vertical"
    aria-valuemin={440} aria-valuemax={760} aria-valuenow={Math.round(chat.workspace.panelWidth)}
    onPointerDown={event => {
      const rect = panel()?.getBoundingClientRect();
      if (!rect) return;
      drag.current = { right: rect.right, width: rect.width };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      if (!drag.current) return;
      drag.current.width = clamp(drag.current.right - event.clientX); preview(drag.current.width);
    }}
    onPointerUp={() => { if (drag.current) chat.setPanelWidth(drag.current.width); drag.current = undefined; }}
    onPointerCancel={() => { drag.current = undefined; preview(chat.workspace.panelWidth); }}
    onKeyDown={event => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Home" || event.key === "End") {
        event.preventDefault();
        chat.setPanelWidth(clamp(event.key === "Home" ? 440 : event.key === "End" ? 760 :
          (panel()?.getBoundingClientRect().width || chat.workspace.panelWidth) + (event.key === "ArrowLeft" ? 20 : -20)));
      }
    }}><span /></div>;
}
