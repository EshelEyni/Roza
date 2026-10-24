import {
  CSSProperties,
  PointerEvent,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { FiX } from "react-icons/fi";
import { useReaderMobile } from "../../hooks/useReaderMobile";

/** On phones this overlays the book; dragging never resizes the EPUB viewport. */
export function ReaderSheet({
  children,
  className = "",
  label,
  mobileFullscreen = false,
  mobileCloseInContent = false,
  onClose,
}: {
  children: ReactNode;
  className?: string;
  label: string;
  mobileFullscreen?: boolean;
  mobileCloseInContent?: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const mobile = useReaderMobile();
  const [height, setHeight] = useState(35);
  const [keyboard, setKeyboard] = useState(0);
  const panel = useRef<HTMLElement>(null);
  const fullScreen = mobile && mobileFullscreen;
  const drag = useRef<{ y: number; height: number; viewport: number }>();
  const suppressClick = useRef(false);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!mobile || !viewport) return;
    const update = () => {
      const obscured = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop,
      );
      setKeyboard(obscured > 100 ? obscured : 0);
      if (obscured > 100) setHeight(80);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, [mobile]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (fullScreen && event.key === "Tab") {
        const controls = Array.from(
          panel.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]',
          ) || [],
        ).filter(element => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (
          first &&
          (event.shiftKey
            ? document.activeElement === first
            : document.activeElement === last)
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    // Keep touch focus in the EPUB so native selection handles survive.
    if (
      !mobile ||
      (fullScreen && !panel.current?.contains(document.activeElement))
    )
      closeButton.current?.focus({ preventScroll: true });
    return () => document.removeEventListener("keydown", onKey);
  }, [mobile, onClose, fullScreen]);

  function finish(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current) return;
    const next =
      drag.current.height +
      ((drag.current.y - event.clientY) / drag.current.viewport) * 100;
    drag.current = undefined;
    if (next < 22) onClose();
    else setHeight(next > 57.5 ? 80 : 35);
  }

  return (
    <>
      {mobile && (
        <button
          className="reader-sheet-backdrop"
          aria-label={t("reader.close")}
          onClick={onClose}
        />
      )}
      <aside
        ref={panel}
        className={
          "reader-panel reader-sheet " +
          className +
          (fullScreen ? " reader-sheet-fullscreen" : "")
        }
        role="dialog"
        aria-label={label}
        aria-modal={fullScreen || undefined}
        style={
          {
            "--reader-sheet-height": height + "%",
            "--reader-keyboard": keyboard + "px",
          } as CSSProperties
        }
        onFocusCapture={event => {
          if (
            mobile &&
            (event.target instanceof HTMLInputElement ||
              event.target instanceof HTMLTextAreaElement)
          )
            setHeight(80);
        }}
      >
        {!fullScreen && (
          <button
            className="reader-sheet-grip"
            aria-label={t("reader.resizePanel")}
            aria-expanded={height > 57.5}
            onClick={() => setHeight(value => (value > 57.5 ? 35 : 80))}
            onPointerDown={event => {
              suppressClick.current = false;
              drag.current = {
                y: event.clientY,
                height,
                viewport: window.innerHeight - keyboard,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={event => {
              if (!drag.current) return;
              setHeight(
                Math.min(
                  80,
                  Math.max(
                    12,
                    drag.current.height +
                      ((drag.current.y - event.clientY) /
                        drag.current.viewport) *
                        100,
                  ),
                ),
              );
            }}
            onPointerUp={event => {
              // A pointer drag should not also trigger the click-to-expand action.
              if (
                drag.current &&
                Math.abs(event.clientY - drag.current.y) > 5
              ) {
                finish(event);
                event.preventDefault();
                suppressClick.current = true;
              } else drag.current = undefined;
            }}
            onClickCapture={event => {
              if (suppressClick.current) {
                suppressClick.current = false;
                event.preventDefault();
                event.stopPropagation();
              }
            }}
            onPointerCancel={() => {
              drag.current = undefined;
              setHeight(value => (value > 57.5 ? 80 : 35));
            }}
          >
            <span />
          </button>
        )}
        {(!mobile || (fullScreen && !mobileCloseInContent)) && (
          <button
            ref={closeButton}
            className="reader-panel-close reader-icon-button"
            onClick={onClose}
            aria-label={t("reader.close")}
          >
            <FiX />
          </button>
        )}
        <div className="reader-sheet-body">{children}</div>
      </aside>
    </>
  );
}
