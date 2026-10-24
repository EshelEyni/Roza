import {
  CSSProperties,
  PointerEvent,
  ReactNode,
  useEffect,
  useLayoutEffect,
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
  const [visibleViewport, setVisibleViewport] = useState(() => ({
    height: window.visualViewport?.height || window.innerHeight,
    top: window.visualViewport?.offsetTop || 0,
  }));
  const panel = useRef<HTMLElement>(null);
  const fullScreen = mobile && mobileFullscreen;
  const drag = useRef<{ y: number; height: number; viewport: number }>();
  const suppressClick = useRef(false);
  const closeButton = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const viewport = window.visualViewport;
    if (!mobile || !viewport) return;
    const update = () => {
      const obscured = Math.max(
        0,
        window.innerHeight -
          viewport.height -
          (fullScreen ? 0 : viewport.offsetTop),
      );
      setKeyboard(obscured > 100 ? obscured : 0);
      setVisibleViewport(previous =>
        previous.height === viewport.height &&
        previous.top === viewport.offsetTop
          ? previous
          : { height: viewport.height, top: viewport.offsetTop },
      );
      if (obscured > 100) setHeight(80);
    };
    let frame = 0;
    let settleUntil = 0;
    const settle = () => {
      update();
      if (performance.now() < settleUntil)
        frame = requestAnimationFrame(settle);
    };
    const refresh = (event?: Event) => {
      if (
        event?.type.startsWith("focus") &&
        event.target instanceof Node &&
        !panel.current?.contains(event.target)
      )
        return;
      // iOS can publish the final keyboard geometry after its last viewport event.
      update();
      settleUntil = performance.now() + 700;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(settle);
    };
    refresh();
    viewport.addEventListener("resize", refresh);
    viewport.addEventListener("scroll", refresh);
    window.addEventListener("resize", refresh);
    window.addEventListener("orientationchange", refresh);
    document.addEventListener("focusin", refresh);
    document.addEventListener("focusout", refresh);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", refresh);
      viewport.removeEventListener("scroll", refresh);
      window.removeEventListener("resize", refresh);
      window.removeEventListener("orientationchange", refresh);
      document.removeEventListener("focusin", refresh);
      document.removeEventListener("focusout", refresh);
    };
  }, [mobile, fullScreen]);

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
      (closeButton.current || panel.current)?.focus({ preventScroll: true });
    return () => document.removeEventListener("keydown", onKey);
  }, [mobile, onClose, fullScreen]);

  useLayoutEffect(() => {
    if (!fullScreen) return;
    // Keep the underlying page stationary while iOS opens or dismisses its keyboard.
    const body = document.body;
    const html = document.documentElement;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      width: body.style.width,
      overflow: body.style.overflow,
      htmlOverflow: html.style.overflow,
    };
    Object.assign(body.style, {
      position: "fixed",
      top: -scrollY + "px",
      left: -scrollX + "px",
      width: "100%",
      overflow: "hidden",
    });
    html.style.overflow = "hidden";
    panel.current?.scrollTo({ top: 0 });
    return () => {
      Object.assign(body.style, {
        position: previous.position,
        top: previous.top,
        left: previous.left,
        width: previous.width,
        overflow: previous.overflow,
      });
      html.style.overflow = previous.htmlOverflow;
      window.scrollTo(scrollX, scrollY);
    };
  }, [fullScreen]);

  useLayoutEffect(() => {
    if (!fullScreen || !panel.current) return;
    // Only the message/results list scrolls; Safari must not pan the panel to its input.
    panel.current.scrollTop = 0;
    panel.current
      .querySelectorAll<HTMLElement>(".reader-sheet-body, .reader-chat")
      .forEach(element => {
        element.scrollTop = 0;
      });
  }, [fullScreen, keyboard, visibleViewport.height, visibleViewport.top]);

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
          className={
            "reader-sheet-backdrop" +
            (fullScreen ? " reader-sheet-backdrop-fullscreen" : "")
          }
          aria-label={t("reader.close")}
          onClick={onClose}
        />
      )}
      <aside
        ref={panel}
        tabIndex={fullScreen ? -1 : undefined}
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
            "--reader-viewport-height": visibleViewport.height + "px",
            "--reader-viewport-top": visibleViewport.top + "px",
            "--reader-modal-bottom-inset":
              keyboard > 100 ? "0px" : "env(safe-area-inset-bottom)",
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
