import { useReaderMobile } from "../../hooks/useReaderMobile";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { FiMoreVertical } from "react-icons/fi";

export function ReaderToolbarMenu({ children, onBeforeOpen, label, mobileOnly }: { children: ReactNode; label?: string; mobileOnly?: boolean; onBeforeOpen?: () => void }) {
  const mobile = useReaderMobile();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>('[data-reader-menu] button:not(:disabled)')?.focus();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    // EPUB pointer events stay inside its document and never bubble to this one.
    const frameDocuments = new Map<HTMLIFrameElement, Document>();
    const closeFromFrame = () => setOpen(false);
    const scope = root.current?.closest(".reader-shell") || document.body;
    const syncFrames = () => {
      const frames = new Set(scope.querySelectorAll<HTMLIFrameElement>("iframe"));
      for (const [frame, doc] of frameDocuments) {
        if (!frames.has(frame) || frame.contentDocument !== doc) {
          doc.removeEventListener("pointerdown", closeFromFrame, true);
          frameDocuments.delete(frame);
        }
      }
      for (const frame of frames) {
        // EPUB documents are same-origin; ignore inaccessible external frames.
        try {
          const doc = frame.contentDocument;
          if (doc && !frameDocuments.has(frame)) {
            doc.addEventListener("pointerdown", closeFromFrame, true);
            frameDocuments.set(frame, doc);
          }
        } catch { /* Cross-origin frames cannot be inspected. */ }
      }
    };
    const observer = new MutationObserver(syncFrames);
    observer.observe(scope, { childList: true, subtree: true });
    scope.addEventListener("load", syncFrames, true);
    syncFrames();
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("pointerdown", outside);
      scope.removeEventListener("load", syncFrames, true);
      observer.disconnect();
      for (const doc of frameDocuments.values())
        doc.removeEventListener("pointerdown", closeFromFrame, true);
    };
  }, [open]);
  if (mobileOnly && !mobile) return <>{children}</>;
  return <div className="reader-toolbar-menu" ref={root}
    onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
    onKeyDown={event => {
      if (event.key === "Escape") {
        event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus();
      } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        if (!open) onBeforeOpen?.();
        event.preventDefault(); event.stopPropagation(); setOpen(true);
        const items = [...(root.current?.querySelectorAll<HTMLButtonElement>('[data-reader-menu] button:not(:disabled)') || [])];
        const index = items.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 :
          (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
      }
    }}>
    <button type="button" className="reader-icon-button" ref={trigger}
      aria-label="Reader menu" title="Reader menu" aria-expanded={open} aria-controls={open ? id : undefined}
      onPointerDown={() => { if (!open) onBeforeOpen?.(); }}
      onKeyDown={event => { if (!open && ["Enter", " "].includes(event.key)) onBeforeOpen?.(); }}
      onClick={() => setOpen(value => !value)}><FiMoreVertical aria-hidden="true" />{label && <span>{label}</span>}</button>
    {open && <div id={id} data-reader-menu className="reader-book-menu-popover reader-toolbar-menu-popover"
      role="group" aria-label="Reader menu" onClick={event => {
        if ((event.target as Element).closest('button:not(:disabled)')) { setOpen(false); trigger.current?.focus(); }
      }}>{children}</div>}
  </div>;
}
