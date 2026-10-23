import { useCallback, useEffect, useRef, useState } from "react";
import ePub, { Book, Contents, Location, NavItem, Rendition } from "epubjs";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FiArrowLeft,
  FiArrowRight,
  FiBookOpen,
  FiMaximize,
  FiMinimize,
  FiSettings,
  FiX,
} from "react-icons/fi";
import { ReaderBook, ReaderPreferences } from "../../../../shared/types/reader";
import readerApiService from "../../services/readerApiService";
import { useReaderState } from "../../hooks/useReaderState";
import { ReaderContents } from "./ReaderContents";
import { ReaderSettings } from "./ReaderSettings";

const palettes = {
  light: { background: "#fffefa", color: "#28231e" },
  sepia: { background: "#f3e8d5", color: "#392e24" },
  dark: { background: "#242622", color: "#e5e4da" },
};

function applyPreferences(
  rendition: Rendition,
  preferences: ReaderPreferences,
) {
  const palette = palettes[preferences.theme];
  rendition.themes.default({
    body: { color: palette.color, background: palette.background },
    "p, li, blockquote": {
      "line-height": preferences.lineHeight + " !important",
    },
    a: {
      color:
        preferences.theme === "dark"
          ? "#d5b88d !important"
          : "#79552e !important",
    },
    img: { "max-width": "100% !important", "object-fit": "contain" },
  });
  rendition.themes.override("color", palette.color, true);
  rendition.themes.override("background", palette.background, true);
  rendition.themes.override("font-size", preferences.fontSize + "px", true);
  rendition.themes.override(
    "font-family",
    preferences.fontFamily === "serif" ? "Georgia, serif" : "Arial, sans-serif",
    true,
  );
  rendition.themes.override(
    "line-height",
    String(preferences.lineHeight),
    true,
  );
}

export function EpubReader({
  book,
  userId,
}: {
  book: ReaderBook;
  userId: string;
}) {
  const { t } = useTranslation();
  const { state, updateState, saveStatus, retrySave } = useReaderState(
    book,
    userId,
  );
  const stateRef = useRef(state);
  stateRef.current = state;
  const updateRef = useRef(updateState);
  updateRef.current = updateState;
  const host = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const epubRef = useRef<Book>();
  const renditionRef = useRef<Rendition>();
  const changingLayout = useRef(false);
  const [toc, setToc] = useState<NavItem[]>([]);
  const [href, setHref] = useState("");
  const [panel, setPanel] = useState<"contents" | "settings" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [atStart, setAtStart] = useState(false);
  const [atEnd, setAtEnd] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [chapter, setChapter] = useState("");

  const move = useCallback(
    (direction: "next" | "prev") => {
      const rendition = renditionRef.current;
      if (rendition)
        void rendition[direction]().catch(() =>
          setError(t("reader.navigationError")),
        );
    },
    [t],
  );

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    let epub: Book | undefined;
    let rendition: Rendition | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let ready = false;
    let locationsReady = false;
    let resizeTimer: ReturnType<typeof setTimeout>;
    const element = host.current!;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        target?.closest(
          "input, textarea, select, button, [contenteditable=true]",
        ) ||
        stateRef.current.preferences.flow !== "paginated"
      )
        return;
      const selection = target?.ownerDocument?.getSelection();
      if (selection && !selection.isCollapsed) return;
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        void rendition?.next().catch(() => undefined);
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        void rendition?.prev().catch(() => undefined);
      }
    };
    async function start() {
      changingLayout.current = false;
      setLoading(true);
      setError("");
      setNotice("");
      try {
        const buffer = await readerApiService.getFile(
          book.id,
          controller.signal,
        );
        if (cancelled) return;
        epub = ePub({ replacements: "blobUrl" });
        await epub.open(buffer, "binary");
        if (cancelled) {
          epub.destroy();
          return;
        }
        epubRef.current = epub;
        let count = 0;
        const fallback: NavItem[] = [];
        epub.spine.each(
          (section: { idref: string; href: string; linear: boolean }) => {
            if (section.linear !== false) {
              count += 1;
              fallback.push({
                id: section.idref,
                href: section.href,
                label: t("reader.section", { number: count }),
              });
            }
          },
        );
        const navigation = await epub.loaded.navigation;
        if (cancelled) {
          epub.destroy();
          return;
        }
        setToc(navigation.toc.length ? navigation.toc : fallback);
        const preferences = stateRef.current.preferences;
        rendition = epub.renderTo(element, {
          width: "100%",
          height: "100%",
          spread: "none",
          flow: preferences.flow === "paginated" ? "paginated" : "scrolled-doc",
          manager: preferences.flow === "scrolled" ? "continuous" : "default",
          allowScriptedContent: false,
        });
        renditionRef.current = rendition;
        applyPreferences(rendition, preferences);
        rendition.hooks.content.register((contents: Contents) => {
          contents.document.addEventListener("keydown", onKey);
          // Never navigate the app or open remote links from an uploaded document.
          contents.document.addEventListener(
            "click",
            event => {
              const anchor = (event.target as Element | null)?.closest?.("a");
              if (
                anchor &&
                /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(
                  anchor.getAttribute("href") || "",
                )
              )
                event.preventDefault();
            },
            true,
          );
          const iframe = element.querySelector("iframe");
          iframe?.setAttribute("title", book.title);
        });
        rendition.on("relocated", (location: Location) => {
          if (cancelled || !ready || changingLayout.current) return;
          const start = location.start;
          setHref(start.href);
          setAtStart(location.atStart);
          setAtEnd(location.atEnd);
          const entry = epub?.navigation.get(start.href);
          setChapter(
            entry?.label || t("reader.section", { number: start.index + 1 }),
          );
          const progress =
            locationsReady && epub?.locations.length()
              ? epub.locations.percentageFromCfi(start.cfi)
              : stateRef.current.progress;
          updateRef.current({
            location: start.cfi,
            progress: location.atEnd
              ? 1
              : Math.min(
                  1,
                  Math.max(
                    0,
                    Number.isFinite(progress)
                      ? progress
                      : stateRef.current.progress,
                  ),
                ),
          });
        });
        try {
          await rendition.display(stateRef.current.location || undefined);
        } catch {
          await rendition.display();
          if (!cancelled) setNotice(t("reader.positionFallback"));
        }
        if (cancelled) return;
        ready = true;
        setLoading(false);
        await rendition.reportLocation();
        void epub.locations
          .generate(1600)
          .then(() => {
            locationsReady = true;
            if (!cancelled) void rendition?.reportLocation();
          })
          .catch(() => undefined);
        document.addEventListener("keydown", onKey);
        resizeObserver = new ResizeObserver(() => {
          if (!ready || cancelled) return;
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => {
            if (!cancelled && rendition) {
              const cfi = stateRef.current.location;
              changingLayout.current = true;
              rendition.resize(element.clientWidth, element.clientHeight);
              void rendition
                .display(cfi || undefined)
                .then(() => {
                  if (cancelled) return;
                  changingLayout.current = false;
                  void rendition?.reportLocation();
                })
                .catch(() => {
                  if (cancelled) return;
                  changingLayout.current = false;
                  setError(t("reader.navigationError"));
                });
            }
          }, 100);
        });
        resizeObserver.observe(element);
      } catch (err) {
        if (!cancelled) {
          setLoading(false);
          setError(err instanceof Error ? err.message : t("reader.openError"));
        }
      }
    }
    void start();
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(resizeTimer);
      resizeObserver?.disconnect();
      document.removeEventListener("keydown", onKey);
      renditionRef.current = undefined;
      epubRef.current = undefined;
      if (epub?.isOpen) epub.destroy();
      element.replaceChildren();
    };
  }, [book.id, book.title, state.preferences.flow, attempt, t]);

  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition || loading) return;
    const cfi = stateRef.current.location;
    changingLayout.current = true;
    applyPreferences(rendition, state.preferences);
    let cancelled = false;
    const timeout = setTimeout(() => {
      void rendition
        .display(cfi || undefined)
        .then(() => {
          if (cancelled || renditionRef.current !== rendition) return;
          changingLayout.current = false;
          void rendition.reportLocation();
        })
        .catch(() => {
          if (cancelled || renditionRef.current !== rendition) return;
          changingLayout.current = false;
          setError(t("reader.navigationError"));
        });
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [state.preferences, loading, t]);

  useEffect(() => {
    const onFullscreen = () =>
      setFullscreen(document.fullscreenElement === shell.current);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  function onNavigate(target: string) {
    setPanel(null);
    void renditionRef.current
      ?.display(target)
      .catch(() => setError(t("reader.navigationError")));
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await shell.current?.requestFullscreen();
    } catch {
      setNotice(t("reader.fullscreenError"));
    }
  }

  return (
    <div
      className={"reader-shell reader-theme-" + state.preferences.theme}
      ref={shell}
    >
      <header className="reader-toolbar">
        <Link
          className="reader-icon-button"
          to="/reader"
          aria-label={t("reader.back")}
          title={t("reader.back")}
        >
          <FiArrowLeft />
        </Link>
        <div className="reader-toolbar-title">
          <h1>{book.title}</h1>
          <p>{book.author || t("reader.unknownAuthor")}</p>
        </div>
        <button
          className={
            "reader-icon-button " + (panel === "contents" ? "is-active" : "")
          }
          onClick={() => setPanel(panel === "contents" ? null : "contents")}
          aria-label={t("reader.contents")}
          aria-expanded={panel === "contents"}
          title={t("reader.contents")}
        >
          <FiBookOpen />
        </button>
        <button
          className={
            "reader-icon-button " + (panel === "settings" ? "is-active" : "")
          }
          onClick={() => setPanel(panel === "settings" ? null : "settings")}
          aria-label={t("reader.settings")}
          aria-expanded={panel === "settings"}
          title={t("reader.settings")}
        >
          <FiSettings />
        </button>
        <button
          className="reader-icon-button"
          onClick={() => void toggleFullscreen()}
          aria-label={t("reader.fullscreen")}
          title={t("reader.fullscreen")}
        >
          {fullscreen ? <FiMinimize /> : <FiMaximize />}
        </button>
      </header>
      <div className="reader-workspace">
        {panel && (
          <aside className="reader-panel">
            <button
              className="reader-panel-close reader-icon-button"
              onClick={() => setPanel(null)}
              aria-label={t("reader.close")}
            >
              <FiX />
            </button>
            {panel === "contents" ? (
              <ReaderContents
                items={toc}
                currentHref={href}
                onNavigate={onNavigate}
              />
            ) : (
              <ReaderSettings
                preferences={state.preferences}
                onChange={preferences => updateState({ preferences })}
              />
            )}
          </aside>
        )}
        <div className={"reader-paper reader-width-" + state.preferences.width}>
          {loading && (
            <div className="reader-overlay" role="status">
              {t("reader.opening")}
            </div>
          )}
          {error && (
            <div className="reader-overlay reader-error" role="alert">
              <p>{error}</p>
              <button
                className="reader-button"
                onClick={() => setAttempt(value => value + 1)}
              >
                {t("reader.retry")}
              </button>
            </div>
          )}
          <div className="reader-viewport" ref={host} dir="ltr" />
        </div>
      </div>
      {notice && (
        <p className="reader-notice" role="status">
          {notice}
        </p>
      )}
      <footer className="reader-footer">
        <button
          className="reader-icon-button"
          onClick={() => move("prev")}
          disabled={loading || atStart}
          aria-label={t("reader.previous")}
          title={t("reader.previous")}
        >
          <FiArrowLeft />
        </button>
        <div className="reader-footer-center">
          <p>{chapter || t("reader.reading")}</p>
          <progress
            value={state.progress}
            max={1}
            aria-label={t("reader.progress")}
          />
          <span>
            {Math.round(state.progress * 100)}% ·{" "}
            {saveStatus === "error" ? (
              <button
                className="reader-save-retry"
                onClick={() => void retrySave()}
              >
                {t("reader.saveError")}
              </button>
            ) : (
              t(saveStatus === "saving" ? "reader.saving" : "reader.saved")
            )}
          </span>
        </div>
        <button
          className="reader-icon-button"
          onClick={() => move("next")}
          disabled={loading || atEnd}
          aria-label={t("reader.next")}
          title={t("reader.next")}
        >
          <FiArrowRight />
        </button>
      </footer>
    </div>
  );
}
