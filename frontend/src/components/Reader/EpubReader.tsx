import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ePub, {
  Book,
  Contents,
  EpubCFI,
  Location,
  NavItem,
  Rendition,
} from "epubjs";
import type { RenditionOptions } from "epubjs/types/rendition";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FiArrowLeft,
  FiArrowRight,
  FiChevronLeft,
  FiChevronRight,
  FiBookOpen,
  FiMaximize,
  FiMinimize,
  FiSettings,
  FiSearch,
  FiMessageSquare,
} from "react-icons/fi";
import { ReaderBook, ReaderPreferences } from "../../../../shared/types/reader";
import readerApiService from "../../services/readerApiService";
import { useReaderState } from "../../hooks/useReaderState";
import { ReaderSheet } from "./ReaderSheet";
import { useReaderMobile } from "../../hooks/useReaderMobile";
import { useReaderPageCount } from "../../hooks/useReaderPageCount";
import { publisherPageAt } from "../../services/readerPublisherPages";
import { bindReaderTouch } from "../../services/readerTouch";
import { protectReaderDocument } from "../../services/readerContentSecurity";
import { ReaderContents } from "./ReaderContents";
import { ReaderSettings } from "./ReaderSettings";
import { ReaderSearch } from "./ReaderSearch";
import { ReaderProgress } from "./ReaderProgress";
import { ReaderChat } from "./ReaderChat";
import { useReaderChat } from "../../hooks/useReaderChat";
import { ReaderDictionary, ReaderTextSelection } from "./ReaderDictionary";

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
    body: {
      color: palette.color,
      background: palette.background,
    },
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
  const mobile = useReaderMobile();
  const mobileRef = useRef(mobile);
  mobileRef.current = mobile;
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
  const fullscreenResizeAnchor = useRef<string | null>(null);
  const pendingResize = useRef<ReturnType<typeof setTimeout>>();
  const layoutTask = useRef<Promise<void>>(Promise.resolve());
  const explicitNavigation = useRef(false);
  const navigationVersion = useRef(0);
  const [textSelection, setTextSelection] =
    useState<ReaderTextSelection | null>(null);
  const closeLookup = useCallback(() => setTextSelection(null), []);
  const selectionRef = useRef(textSelection);
  selectionRef.current = textSelection;
  const [toc, setToc] = useState<NavItem[]>([]);
  const [href, setHref] = useState("");
  const [panel, setPanel] = useState<
    "contents" | "settings" | "search" | "chat" | null
  >(null);
  const panelRef = useRef(panel);
  panelRef.current = panel;
  const closePanel = useCallback(() => setPanel(null), []);
  function togglePanel(next: NonNullable<typeof panel>) {
    setTextSelection(null);
    setPanel(current => (current === next ? null : next));
  }
  const [location, setLocation] = useState<Location | null>(null);
  const [searchBook, setSearchBook] = useState<Book | null>(null);
  const [paginationFile, setPaginationFile] = useState<ArrayBuffer | null>(
    null,
  );
  // Numbering changes only affect the footer, never the EPUB layout or page measurement.
  const renderingPreferences = useMemo(
    () => ({
      fontSize: state.preferences.fontSize,
      fontFamily: state.preferences.fontFamily,
      lineHeight: state.preferences.lineHeight,
      width: state.preferences.width,
      theme: state.preferences.theme,
      flow: state.preferences.flow,
    }),
    [
      state.preferences.fontSize,
      state.preferences.fontFamily,
      state.preferences.lineHeight,
      state.preferences.width,
      state.preferences.theme,
      state.preferences.flow,
    ],
  );
  const { screen: pageCount, publisherPages } = useReaderPageCount(
    host,
    paginationFile,
    renderingPreferences,
    location,
    applyPreferences,
  );
  const showPublisherPages = state.preferences.pageNumbering === "publisher";
  const publisherLabel =
    publisherPages && location
      ? (publisherPageAt(publisherPages, location.start.cfi)?.label ?? null)
      : null;
  const [locationsReady, setLocationsReady] = useState(false);
  const highlightedCfi = useRef("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [atStart, setAtStart] = useState(false);
  const [atEnd, setAtEnd] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [chapter, setChapter] = useState("");
  const readingBoundary = useRef("");
  const chat = useReaderChat(
    book.id,
    () => readingBoundary.current || stateRef.current.location,
  );

  const move = useCallback(
    (direction: "next" | "prev") => {
      if (changingLayout.current) return;
      const rendition = renditionRef.current;
      setTextSelection(null);
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
    const touchCleanups: (() => void)[] = [];
    let ready = false;
    let hasLocations = false;
    const element = host.current!;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTextSelection(null);
      const target = event.target as HTMLElement | null;
      if (
        changingLayout.current ||
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
      fullscreenResizeAnchor.current = null;
      explicitNavigation.current = false;
      layoutTask.current = Promise.resolve();
      setLoading(true);
      setSearchBook(null);
      setPaginationFile(null);
      setLocation(null);
      setLocationsReady(false);
      highlightedCfi.current = "";
      readingBoundary.current = "";
      setError("");
      setNotice("");
      try {
        const buffer = await readerApiService.getFile(
          book.id,
          controller.signal,
        );
        if (cancelled) return;
        epub = ePub({ replacements: "blobUrl" });
        epub.spine.hooks.content.register(protectReaderDocument);
        await epub.open(buffer, "binary");
        await Promise.all([epub.opened, epub.ready]);
        if (cancelled) {
          epub.destroy();
          return;
        }
        epubRef.current = epub;
        setSearchBook(epub);
        setPaginationFile(buffer);
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
        const renderOptions: RenditionOptions & { gap: number } = {
          width: "100%",
          height: "100%",
          spread: "none",
          flow: preferences.flow === "paginated" ? "paginated" : "scrolled-doc",
          manager: preferences.flow === "scrolled" ? "continuous" : "default",
          // WebKit blocks parent event callbacks without this sandbox permission.
          // protectReaderDocument blocks book scripts before iframe parsing.
          allowScriptedContent: true,
          gap: 40,
        };
        rendition = epub.renderTo(element, renderOptions);
        renditionRef.current = rendition;
        applyPreferences(rendition, preferences);
        rendition.hooks.content.register((contents: Contents) => {
          contents.document.addEventListener("keydown", onKey);
          contents.document.addEventListener("pointerdown", () => {
            if (!mobileRef.current) setTextSelection(null);
          });
          // iOS owns long-press selection and its draggable native handles.
          contents.addStylesheetRules(
            {
              "html, body": {
                "-webkit-user-select": "text",
                "user-select": "text",
                "touch-action": "pan-y pinch-zoom",
              },
            },
            "reader-touch",
          );
          touchCleanups.push(
            bindReaderTouch(contents.document, {
              enabled: () =>
                mobileRef.current &&
                ready &&
                !cancelled &&
                !changingLayout.current,
              paginated: () =>
                stateRef.current.preferences.flow === "paginated",
              blocked: () => !!panelRef.current,
              selected: () => !!selectionRef.current,
              dismissSelection: () => setTextSelection(null),
              move: direction => move(direction),
            }),
          );
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
        rendition.on("selected", (cfi: string, contents: Contents) => {
          if (cancelled || changingLayout.current) return;
          const range = contents.range(cfi);
          const text = range.toString().trim();
          if (!text || text.length > 3000) {
            setTextSelection(null);
            if (text.length > 3000) setNotice(t("reader.chat.selectionLimit"));
            return;
          }
          const candidate = text.replace(/^[“"‘(]+|[”"’.,;:!?)]+$/g, "");
          const word =
            /^[a-zA-Z]+(?:['’‘-][a-zA-Z]+)*$/.test(candidate) &&
            candidate.length <= 80
              ? candidate
              : undefined;
          const rect = range.getBoundingClientRect();
          const frame = contents.document.defaultView?.frameElement;
          if (!frame) return;
          const offset = frame.getBoundingClientRect();
          if (mobileRef.current && panelRef.current) return;
          setTextSelection({
            text,
            word,
            cfi,
            x: offset.left + rect.left,
            y: offset.top + rect.bottom + 8,
          });
        });
        rendition.on("relocated", (location: Location) => {
          if (cancelled || !ready || changingLayout.current) return;
          setTextSelection(null);
          setLocation(location);
          const start = location.start;
          readingBoundary.current = location.end.cfi || start.cfi;
          setHref(start.href);
          setAtStart(location.atStart);
          setAtEnd(location.atEnd);
          const entry = epub?.navigation.get(start.href);
          setChapter(
            entry?.label || t("reader.section", { number: start.index + 1 }),
          );
          const progress =
            hasLocations && epub?.locations.length()
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
            if (cancelled) return;
            hasLocations = true;
            setLocationsReady(epub!.locations.length() > 0);
            void rendition?.reportLocation();
          })
          .catch(() => undefined);
        document.addEventListener("keydown", onKey);
        resizeObserver = new ResizeObserver(() => {
          if (!ready || cancelled || explicitNavigation.current) return;
          changingLayout.current = true;
          clearTimeout(pendingResize.current);
          pendingResize.current = setTimeout(() => {
            if (!cancelled && rendition && !explicitNavigation.current) {
              const cfi =
                fullscreenResizeAnchor.current ?? stateRef.current.location;
              changingLayout.current = true;
              const resize = rendition.resize as (
                width: number,
                height: number,
                cfi?: string,
              ) => void;
              resize.call(
                rendition,
                element.clientWidth,
                element.clientHeight,
                cfi || undefined,
              );
              layoutTask.current = rendition
                .display(cfi || undefined)
                .then(() => {
                  if (cancelled) return;
                  fullscreenResizeAnchor.current = null;
                  changingLayout.current = false;
                  void rendition?.reportLocation();
                })
                .catch(() => {
                  if (cancelled) return;
                  fullscreenResizeAnchor.current = null;
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
    const opening = start();
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(pendingResize.current);
      resizeObserver?.disconnect();
      touchCleanups.forEach(cleanup => cleanup());
      document.removeEventListener("keydown", onKey);
      renditionRef.current = undefined;
      epubRef.current = undefined;
      // EPUB open() returns before its navigation and resource work settles.
      void opening.then(() => {
        if (epub?.isOpen) epub.destroy();
      });
      element.replaceChildren();
    };
  }, [book.id, book.title, state.preferences.flow, attempt, t, move]);

  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition || loading) return;
    const cfi = stateRef.current.location;
    changingLayout.current = true;
    applyPreferences(rendition, renderingPreferences);
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (explicitNavigation.current) return;
      layoutTask.current = rendition
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
  }, [renderingPreferences, loading, t]);

  useEffect(() => {
    const onFullscreen = () =>
      setFullscreen(document.fullscreenElement === shell.current);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  async function navigateTo(target: string) {
    setTextSelection(null);
    if (target.startsWith("epubcfi(")) {
      const anchor = new EpubCFI(target);
      anchor.collapse(true);
      target = anchor.toString();
    }
    const rendition = renditionRef.current;
    if (!rendition) return;
    const version = ++navigationVersion.current;
    explicitNavigation.current = true;
    clearTimeout(pendingResize.current);
    try {
      await layoutTask.current;
      if (
        version !== navigationVersion.current ||
        renditionRef.current !== rendition
      )
        return;
      changingLayout.current = true;
      const element = host.current;
      if (element) {
        // epub.js accepts an optional CFI here but omits it from its TypeScript definition.
        const resize = rendition.resize as (
          width: number,
          height: number,
          cfi?: string,
        ) => void;
        resize.call(
          rendition,
          element.clientWidth,
          element.clientHeight,
          target,
        );
      }
      await rendition.display(target);
      // Continuous views can expand while neighboring sections are inserted.
      // Re-anchor once after layout has painted, using the now-final offsets.
      await new Promise<void>(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      if (
        renditionRef.current !== rendition ||
        version !== navigationVersion.current
      )
        return;
      await rendition.display(target);
      if (
        version !== navigationVersion.current ||
        renditionRef.current !== rendition
      )
        return;
      changingLayout.current = false;
      await rendition.reportLocation();
    } finally {
      if (
        version === navigationVersion.current &&
        renditionRef.current === rendition
      ) {
        explicitNavigation.current = false;
        changingLayout.current = false;
      }
    }
  }

  function onNavigate(target: string) {
    setPanel(null);
    void navigateTo(target).catch(() => setError(t("reader.navigationError")));
  }

  async function onSearchNavigate(cfi: string) {
    const rendition = renditionRef.current;
    if (!rendition) return;
    try {
      await navigateTo(cfi);
      if (renditionRef.current !== rendition) return;
      if (highlightedCfi.current)
        rendition.annotations.remove(highlightedCfi.current, "highlight");
      rendition.annotations.highlight(
        cfi,
        {},
        undefined,
        "reader-search-highlight",
        {
          fill: "#d6a750",
          "fill-opacity": "0.4",
          "mix-blend-mode": "multiply",
        },
      );
      highlightedCfi.current = cfi;
      if (mobileRef.current) setPanel(null);
    } catch {
      if (renditionRef.current === rendition)
        setNotice(t("reader.navigationError"));
    }
  }

  async function onProgressNavigate(progress: number) {
    const epub = epubRef.current;
    const rendition = renditionRef.current;
    if (!epub || !rendition || !locationsReady) return;
    try {
      const target =
        progress <= 0
          ? epub.spine.first().href
          : epub.locations.cfiFromPercentage(progress);
      await navigateTo(target);
    } catch {
      if (renditionRef.current === rendition)
        setNotice(t("reader.navigationError"));
    }
  }

  async function toggleFullscreen() {
    // Capture before fullscreen changes the available reading area.
    fullscreenResizeAnchor.current = stateRef.current.location;
    if (mobile) {
      setImmersive(value => !value);
      setPanel(null);
      setTextSelection(null);
      return;
    }
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await shell.current?.requestFullscreen();
    } catch {
      setNotice(t("reader.fullscreenError"));
    }
  }

  return (
    <div
      className={
        "reader-shell reader-theme-" +
        state.preferences.theme +
        (mobile && immersive ? " reader-immersive" : "")
      }
      ref={shell}
    >
      {textSelection && (
        <ReaderDictionary
          key={textSelection.cfi}
          selection={textSelection}
          bookId={book.id}
          onClose={closeLookup}
          aiDisabled={chat.sending || chat.loading}
          onAskAi={() => {
            chat.start({ cfi: textSelection.cfi, text: textSelection.text });
            setPanel("chat");
            closeLookup();
          }}
        />
      )}
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
            "reader-icon-button " + (panel === "chat" ? "is-active" : "")
          }
          onClick={() => togglePanel("chat")}
          aria-label={t("reader.chat.title")}
          aria-expanded={panel === "chat"}
          title={t("reader.chat.title")}
          disabled={loading || !!error}
        >
          <FiMessageSquare />
        </button>
        <button
          className={
            "reader-icon-button " + (panel === "search" ? "is-active" : "")
          }
          onClick={() => togglePanel("search")}
          aria-label={t("reader.search")}
          aria-expanded={panel === "search"}
          title={t("reader.search")}
        >
          <FiSearch />
        </button>
        <button
          className={
            "reader-icon-button " + (panel === "contents" ? "is-active" : "")
          }
          onClick={() => togglePanel("contents")}
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
          onClick={() => togglePanel("settings")}
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
          aria-pressed={mobile ? immersive : fullscreen}
        >
          {(mobile ? immersive : fullscreen) ? <FiMinimize /> : <FiMaximize />}
        </button>
      </header>
      <div className="reader-workspace">
        {panel && (
          <ReaderSheet
            mobileFullscreen={panel === "search" || panel === "chat"}
            mobileCloseInContent={panel === "search" || panel === "chat"}
            label={t(
              panel === "chat"
                ? "reader.chat.title"
                : panel === "contents"
                  ? "reader.contents"
                  : panel === "search"
                    ? "reader.search"
                    : "reader.settings",
            )}
            onClose={closePanel}
            className={
              panel === "search"
                ? "reader-search-panel"
                : panel === "chat"
                  ? "reader-chat-panel"
                  : ""
            }
          >
            {panel === "contents" ? (
              <ReaderContents
                items={toc}
                currentHref={href}
                onNavigate={onNavigate}
              />
            ) : panel === "search" ? (
              <ReaderSearch
                onClose={closePanel}
                book={loading ? null : searchBook}
                locationsReady={locationsReady}
                onNavigate={cfi => void onSearchNavigate(cfi)}
              />
            ) : panel === "chat" ? (
              <ReaderChat chat={chat} onClose={closePanel} />
            ) : (
              <ReaderSettings
                preferences={state.preferences}
                publisherPagesAvailable={
                  publisherPages === null ? null : publisherPages.length > 0
                }
                onChange={preferences => updateState({ preferences })}
              />
            )}
          </ReaderSheet>
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
          <div
            className={
              "reader-page-turn-area" +
              (loading || !!error || atStart ? " is-disabled" : "")
            }
            onClick={() => {
              if (!loading && !error && !atStart) move("prev");
            }}
          >
            <button
              className="reader-page-turn reader-page-turn-previous"
              disabled={loading || !!error || atStart}
              aria-label={t("reader.previous")}
              title={t("reader.previous")}
            >
              <FiChevronLeft aria-hidden="true" />
            </button>
          </div>
          <div className="reader-viewport" ref={host} dir="ltr" />
          <div
            className={
              "reader-page-turn-area" +
              (loading || !!error || atEnd ? " is-disabled" : "")
            }
            onClick={() => {
              if (!loading && !error && !atEnd) move("next");
            }}
          >
            <button
              className="reader-page-turn reader-page-turn-next"
              disabled={loading || !!error || atEnd}
              aria-label={t("reader.next")}
              title={t("reader.next")}
            >
              <FiChevronRight aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      {mobile && saveStatus === "error" && (
        <p className="reader-notice" role="status">
          <button
            className="reader-save-retry"
            onClick={() => void retrySave()}
          >
            {t("reader.saveError")}
          </button>
        </p>
      )}
      {notice && (
        <p className="reader-notice" role="status">
          {notice}
        </p>
      )}
      <footer className="reader-footer">
        <div className="reader-mobile-progress">
          <span>{Math.round(state.progress * 100)}%</span>
          <ReaderProgress
            progress={state.progress}
            ready={locationsReady && !loading}
            onNavigate={onProgressNavigate}
          />
          <span>
            {showPublisherPages && publisherPages?.length
              ? t("reader.bookPageOfTotal", {
                  page: publisherLabel || "—",
                  total: publisherPages[publisherPages.length - 1].label,
                })
              : pageCount
                ? t("reader.pageOfTotal", {
                    page: pageCount.page,
                    total: pageCount.total,
                  })
                : t("reader.countingPages")}
          </span>
        </div>
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
          <ReaderProgress
            progress={state.progress}
            ready={locationsReady && !loading}
            onNavigate={onProgressNavigate}
          />
          <div className="reader-footer-indicators">
            <button
              className="reader-page-count reader-page-count-toggle"
              type="button"
              aria-pressed={showPublisherPages}
              title={t(
                showPublisherPages
                  ? "reader.showScreenPages"
                  : "reader.showBookPages",
              )}
              aria-label={t(
                showPublisherPages
                  ? "reader.showScreenPages"
                  : "reader.showBookPages",
              )}
              onClick={() => {
                if (publisherPages === null)
                  setNotice(t("reader.preparingBookPages"));
                else if (!publisherPages.length)
                  setNotice(t("reader.noBookPages"));
                else {
                  updateState({
                    preferences: {
                      ...state.preferences,
                      pageNumbering: showPublisherPages
                        ? "screen"
                        : "publisher",
                    },
                  });
                  setNotice("");
                }
              }}
            >
              {showPublisherPages && publisherPages?.length
                ? t("reader.bookPageOfTotal", {
                    page: publisherLabel || "—",
                    total: publisherPages[publisherPages.length - 1].label,
                  })
                : pageCount
                  ? t("reader.pageOfTotal", {
                      page: pageCount.page,
                      total: pageCount.total,
                    })
                  : t("reader.countingPages")}
            </button>
            <span>
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
            <span className="reader-percent">
              {Math.round(state.progress * 100)}%
            </span>
          </div>
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
