import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { useReaderChat } from "../../hooks/useReaderChat";

export function ReaderChatResize({ chat }: { chat: ReturnType<typeof useReaderChat> }) {
  const { t } = useTranslation();
  const handle = useRef<HTMLDivElement>(null);
  const drag = useRef<{ right: number; width: number }>();
  const [bounds, setBounds] = useState({ maximum: 440, width: 440 });
  const panel = useCallback(() => handle.current?.closest<HTMLElement>(".reader-chat-panel"), []);
  const maximum = useCallback(() => Math.max(440, panel()?.parentElement?.clientWidth || window.innerWidth), [panel]);
  const clamp = useCallback((width: number) => Math.max(440, Math.min(maximum(), width)), [maximum]);
  const preview = useCallback((width: number) => {
    const next = clamp(width), limit = maximum();
    const element = panel();
    // Retain the original split layout up to its cap; only the excess overlays the book.
    const splitLimit = Math.min(760, Math.max(440, limit - 480));
    element?.parentElement?.style.setProperty("--reader-chat-dock-width", Math.min(next, splitLimit) + "px");
    element?.style.setProperty("--reader-chat-panel-width", next + "px");
    setBounds(previous => previous.maximum === limit && previous.width === next ? previous : { maximum: limit, width: next });
  }, [panel, clamp, maximum]);
  useLayoutEffect(() => {
    const refresh = () => preview(drag.current?.width ?? chat.workspace.panelWidth);
    refresh();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(refresh);
    const workspace = panel()?.parentElement;
    if (workspace) observer?.observe(workspace);
    window.addEventListener("resize", refresh);
    return () => { observer?.disconnect(); window.removeEventListener("resize", refresh); };
  }, [chat.workspace.panelWidth, preview, panel]);
  return <div ref={handle} className="reader-chat-resize" role="separator" tabIndex={0}
    aria-label={t("reader.chat.tabs.resize")} aria-orientation="vertical"
    aria-valuemin={440} aria-valuemax={Math.round(bounds.maximum)} aria-valuenow={Math.round(bounds.width)}
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
        chat.setPanelWidth(clamp(event.key === "Home" ? 440 : event.key === "End" ? maximum() :
          (panel()?.getBoundingClientRect().width || chat.workspace.panelWidth) + (event.key === "ArrowLeft" ? 20 : -20)));
      }
    }}><span /></div>;
}
