import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export function ReaderPanelResize({ width, onWidthChange, minimumWidth = 260, label, className = "" }: {
  width: number; onWidthChange: (width: number) => void; minimumWidth?: number; label?: string; className?: string;
}) {
  const { t } = useTranslation();
  const handle = useRef<HTMLDivElement>(null);
  const drag = useRef<{ right: number; width: number }>();
  const [bounds, setBounds] = useState({ maximum: minimumWidth, width: minimumWidth });
  const panel = useCallback(() => handle.current?.closest<HTMLElement>(".reader-panel"), []);
  const maximum = useCallback(() => Math.max(minimumWidth, panel()?.parentElement?.clientWidth || window.innerWidth), [panel, minimumWidth]);
  const clamp = useCallback((width: number) => Math.max(minimumWidth, Math.min(maximum(), width)), [maximum, minimumWidth]);
  const preview = useCallback((width: number) => {
    const next = clamp(width), limit = maximum();
    const element = panel();
    // Retain the original split layout up to its cap; only the excess overlays the book.
    const splitLimit = Math.min(760, Math.max(minimumWidth, limit - 480));
    element?.parentElement?.style.setProperty("--reader-panel-dock-width", Math.min(next, splitLimit) + "px");
    element?.style.setProperty("--reader-panel-width", next + "px");
    element?.style.setProperty("--reader-panel-min-width", minimumWidth + "px");
    setBounds(previous => previous.maximum === limit && previous.width === next ? previous : { maximum: limit, width: next });
  }, [panel, clamp, maximum, minimumWidth]);
  useLayoutEffect(() => {
    const refresh = () => preview(drag.current?.width ?? width);
    refresh();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(refresh);
    const workspace = panel()?.parentElement;
    if (workspace) observer?.observe(workspace);
    window.addEventListener("resize", refresh);
    return () => { observer?.disconnect(); window.removeEventListener("resize", refresh); };
  }, [width, preview, panel]);
  return <div ref={handle} className={"reader-panel-resize " + className} role="separator" tabIndex={0}
    aria-label={label || t("reader.resizePanel")} aria-orientation="vertical"
    aria-valuemin={minimumWidth} aria-valuemax={Math.round(bounds.maximum)} aria-valuenow={Math.round(bounds.width)}
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
    onPointerUp={() => { if (drag.current) onWidthChange(drag.current.width); drag.current = undefined; }}
    onPointerCancel={() => { drag.current = undefined; preview(width); }}
    onKeyDown={event => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Home" || event.key === "End") {
        event.preventDefault();
        onWidthChange(clamp(event.key === "Home" ? minimumWidth : event.key === "End" ? maximum() :
          (panel()?.getBoundingClientRect().width || width) + (event.key === "ArrowLeft" ? 20 : -20)));
      }
    }}><span /></div>;
}
