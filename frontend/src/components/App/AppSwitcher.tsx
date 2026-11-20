import { cloneElement, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { mainSectionOf, useMainNavLinks } from "./useMainNavLinks";
import "./appSwitcher.css";

type AppSwitcherProps = {
  /** Class for the trigger, so it matches the toolbar it sits in. */
  triggerClassName: string;
  /** Navigate through the page's own exit step (for example, the studio's save check). */
  onNavigate?: (path: string) => void;
};

/** A compact menu of Roza's main pages for screens that hide the main header. */
export function AppSwitcher({ triggerClassName, onNavigate }: AppSwitcherProps) {
  const { t } = useTranslation();
  const links = useMainNavLinks();
  const { pathname } = useLocation();
  const current = mainSectionOf(pathname);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLElement>(".app-switcher-item")?.focus();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    // Clicks inside the book's iframe never reach this document, but they blur the window.
    const close = () => setOpen(false);
    document.addEventListener("pointerdown", outside);
    window.addEventListener("blur", close);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("blur", close);
    };
  }, [open]);

  const closeAndFocus = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <div
      className="app-switcher"
      ref={root}
      onBlur={event => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={event => {
        if (!open) return;
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          closeAndFocus();
        } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          event.stopPropagation();
          const items = [...(root.current?.querySelectorAll<HTMLElement>(".app-switcher-item") || [])];
          const index = items.indexOf(document.activeElement as HTMLElement);
          const next =
            event.key === "Home" ? 0
            : event.key === "End" ? items.length - 1
            : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
          items[next]?.focus();
        }
      }}
    >
      <button
        type="button"
        ref={trigger}
        className={`${triggerClassName} app-switcher-trigger`}
        aria-label={t("appSwitcher.label")}
        title={t("appSwitcher.label")}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen(value => !value)}
      >
        <img src="/images/android-chrome-512x512.png" alt="" aria-hidden="true" />
      </button>
      {open && (
        <nav id={menuId} className="app-switcher-menu" aria-label={t("appSwitcher.label")}>
          {links.map(({ name, icon, link }) => (
            <Link
              key={link}
              to={link}
              className="app-switcher-item"
              aria-current={link === current ? "page" : undefined}
              onClick={event => {
                setOpen(false);
                if (!onNavigate) return;
                event.preventDefault();
                onNavigate(link);
              }}
            >
              {cloneElement(icon, { className: "app-switcher-icon", "aria-hidden": true })}
              <span>{name}</span>
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
