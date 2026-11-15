import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { FiMoreVertical } from "react-icons/fi";

export function ReaderToolbarMenu({ children, onBeforeOpen }: { children: ReactNode; onBeforeOpen?: () => void }) {
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
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
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
      onClick={() => setOpen(value => !value)}><FiMoreVertical aria-hidden="true" /></button>
    {open && <div id={id} data-reader-menu className="reader-book-menu-popover reader-toolbar-menu-popover"
      role="group" aria-label="Reader menu" onClick={event => {
        if ((event.target as Element).closest('button:not(:disabled)')) { setOpen(false); trigger.current?.focus(); }
      }}>{children}</div>}
  </div>;
}
