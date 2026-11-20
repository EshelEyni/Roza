import { loadReaderChapters, readerChapterAt } from "../services/readerChapters";
import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import ePub, { EpubCFI, Location, Rendition, type Contents } from "epubjs";
import Section from "epubjs/types/section";
import { contentDigest, readPageMap, savePageMap, type ReaderPageMap } from "../services/readerPageMapCache";
import { ReaderPreferences } from "../../../shared/types/reader";

import {
  loadPublisherPages,
  PublisherPage,
} from "../services/readerPublisherPages";

type PageCount = { page: number; total: number; sectionRemaining?: number | null };

/** Measure actual screen pages in a separate rendition, never seek the visible reader. */
export function useReaderPageCount(
  host: RefObject<HTMLDivElement>,
  file: ArrayBuffer | null,
  preferences: ReaderPreferences,
  location: Location | null,
  apply: (rendition: Rendition, preferences: ReaderPreferences) => void,
) {
  const cachedPageLookup = useRef<((cfi: string) => PageCount | null) | null>(null);
  const getCachedPage = useCallback((cfi: string) => cachedPageLookup.current?.(cfi) ?? null, []);
  const pageTargetLookup = useRef<((page: number) => Promise<string | null>) | null>(null);
  const getPageCfi = useCallback(async (page: number) => pageTargetLookup.current?.(page) ?? null, []);
  const pageLookup = useRef<((cfi: string) => Promise<PageCount | null>) | null>(null);
  const getPage = useCallback(async (cfi: string) => pageLookup.current?.(cfi) ?? null, []);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [count, setCount] = useState<PageCount | null>(null);
  const [publisherPages, setPublisherPages] = useState<PublisherPage[] | null>(
    null,
  );
  const publisherCache = useRef<{
    file: ArrayBuffer;
    pages: PublisherPage[];
  }>();
  const latestLocation = useRef(location);
  latestLocation.current = location;
  const updatePage = useRef<(() => void) | null>(null);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let timer: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(
        () =>
          setSize(previous => {
            const width = element.clientWidth;
            const height = element.clientHeight;
            return previous.width === width && previous.height === height
              ? previous
              : { width, height };
          }),
        250,
      );
    });
    observer.observe(element);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [host]);

  useEffect(() => {
    pageLookup.current = null;
    pageTargetLookup.current = null;
    cachedPageLookup.current = null;
    setCount(null);
    setPublisherPages(
      file && publisherCache.current?.file === file
        ? publisherCache.current.pages
        : null,
    );
    if (!file || !size.width || !size.height) return;
    const controller = new AbortController();
    let cancelled = false;
    const container = document.createElement("div");
    container.className = "reader-page-measurement";
    container.setAttribute("aria-hidden", "true");
    container.setAttribute("inert", "");
    Object.assign(container.style, {
      position: "fixed",
      left: "-100000px",
      top: "0",
      width: size.width + "px",
      height: size.height + "px",
      // EPUB.js sets visibility on its child frames. Opacity and containment
      // keep their contents out of painting while preserving measurable layout.
      opacity: "0",
      contain: "strict",
      pointerEvents: "none",
    });
    // Own the archive and spine: the visible book may be destroyed on a flow change.
    const book = ePub({ replacements: "blobUrl" });
    let measuring: Rendition;
    const renderOptions = {
      width: size.width,
      height: size.height,
      spread: "none",
      flow: "paginated",
      manager: "default",
      // Write into each measurement frame instead of navigating it to srcdoc.
      method: "write",
      allowScriptedContent: false,
      gap: 40,
    } satisfies NonNullable<ConstructorParameters<typeof Rendition>[1]> & {
      method: "write";
      gap: number;
    };
    const waitForAssets = async (contents: { document: Document }) => {
      const doc = contents.document;
      await Promise.race([
        Promise.all([
          doc.fonts.ready,
          ...Array.from(doc.images, image =>
            image.complete
              ? Promise.resolve()
              : new Promise<void>(resolve => {
                  image.addEventListener("load", () => resolve(), {
                    once: true,
                  });
                  image.addEventListener("error", () => resolve(), {
                    once: true,
                  });
                }),
          ),
        ]),
        new Promise(resolve => setTimeout(resolve, 2500)),
      ]);
    };
    async function getLocation() {
      // reportLocation's declared promise completes before its animation-frame event.
      return new Promise<Location>(resolve => {
        measuring.once("relocated", resolve);
        void measuring.reportLocation();
      });
    }
    function installPageMap({ pages, sections, chapters, publisherPages }: ReaderPageMap) {
      const total = pages.length;
      const offsets = new Map(sections);
      const compare = new EpubCFI().compare;
      const ordered = pages.map((cfi, index) => ({ cfi, page: index + 1 }))
        .sort((a, b) => compare(a.cfi, b.cfi));

      function pageAt(cfi: string, inclusive: boolean) {
        let low = 0;
        let high = ordered.length;
        while (low < high) {
          const mid = Math.floor((low + high) / 2);
          const order = compare(ordered[mid].cfi, cfi);
          if (order < 0 || (inclusive && order === 0)) low = mid + 1;
          else high = mid;
        }
        return low ? ordered[low - 1].page : 1;
      }

      const chapterEnds = chapters.map((_, index) => {
        const next = chapters[index + 1];
        return next ? pageAt(next.cfi, false) : total;
      });
      function lookup(cfi: string) {
        const point = new EpubCFI(cfi);
        point.collapse(true);
        const section = offsets.get(point.spinePos);
        if (!section) return null;
        const page = pageAt(point.toString(), true);
        return { page: Math.max(section.offset + 1, Math.min(section.offset + section.pages, page)), total };
      }

      cachedPageLookup.current = lookup;
      pageLookup.current = async cfi => lookup(cfi);
      pageTargetLookup.current = async page => Number.isInteger(page) ? pages[page - 1] ?? null : null;
      updatePage.current = () => {
        const current = latestLocation.current;
        if (!current) return;
        const { cfi, index, displayed } = current.start;
        const section = offsets.get(index);
        const page = section && (preferences.flow === "scrolled"
          ? lookup(cfi)?.page
          : section.offset + Math.min(section.pages, Math.max(1, displayed.page)));
        if (page === undefined) {
          setCount(null);
          return;
        }
        const chapter = readerChapterAt(chapters, cfi);
        setCount({ page, total, sectionRemaining: chapter ? Math.max(0, chapterEnds[chapters.indexOf(chapter)] - page) : null });
      };
      updatePage.current();
      setPublisherPages(publisherPages);
    }
    async function measure() {
      try {
        const digest = await contentDigest(file!);
        if (cancelled) return;
        const key = digest && JSON.stringify([
          digest, size.width, size.height, window.devicePixelRatio, navigator.userAgent,
          preferences.fontSize, preferences.fontFamily, preferences.lineHeight,
          preferences.width, preferences.flow,
        ]);
        const cached = key && readPageMap(key);
        if (cached) {
          installPageMap(cached);
          return;
        }
        document.body.append(container);
        const offsets = new Map<number, { offset: number; pages: number }>();
        const pageStarts: string[] = [];
        let total = 0;
        await book.open(file!, "binary");
        await Promise.all([book.opened, book.ready]);
        if (cancelled) return;
        measuring = book.renderTo(container, renderOptions);
        apply(measuring, preferences);
        measuring.hooks.content.register(waitForAssets);
        const sections: Section[] = [];
        book!.spine.each((section: Section) => {
          if (section.linear !== false) sections.push(section);
        });
        for (const section of sections) {
          if (cancelled) return;
          await measuring.display(section.href);
          if (cancelled) return;
          const measured = await getLocation();
          if (cancelled) return;
          const pages = Math.max(1, measured.start.displayed.total);
          offsets.set(section.index, { offset: total, pages });
          // Map every page while its section is already rendered for counting.
          // Hover previews then use this index without rendering or async lookups.
          const manager = (measuring as unknown as { manager: {
            current: () => { contents: Contents };
            layout: { pageWidth: number; width: number };
            settings: { direction: string };
            mapping: { page: (contents: Contents, base: string, start: number, end: number) => { start: string } };
          } }).manager;
          const view = manager.current();
          for (let index = 0; index < pages; index++) {
            const physical = manager.settings.direction === "rtl" ? pages - index - 1 : index;
            const start = physical * manager.layout.pageWidth;
            const mapped = manager.mapping.page(view.contents, section.cfiBase, start, start + manager.layout.width);
            pageStarts.push(mapped.start);
          }
          total += pages;
        }
        if (cancelled) return;
        const chapters = await loadReaderChapters(book);
        if (cancelled) return;
        const pages =
          publisherCache.current?.file === file
            ? publisherCache.current.pages
            : await loadPublisherPages(book, controller.signal).catch(() => []);
        if (!cancelled) {
          publisherCache.current = { file: file!, pages };
          if (!pageStarts.length) {
            setPublisherPages(pages);
            return;
          }
          const map = { pages: pageStarts, sections: [...offsets], chapters, publisherPages: pages };
          installPageMap(map);
          if (key) savePageMap(key, map);
        }
      } catch {
        if (!cancelled) setCount(null);
      }
    }
    // The completed map handles lookups and jumps without a hidden renderer.
    void measure().finally(() => {
      try {
        book.destroy();
      } finally {
        container.remove();
      }
    });
    return () => {
      cancelled = true;
      controller.abort();
      updatePage.current = null;
      pageLookup.current = null;
      pageTargetLookup.current = null;
      cachedPageLookup.current = null;
    };
  }, [file, size, preferences, apply]);

  useEffect(() => {
    updatePage.current?.();
  }, [location]);
  return { screen: count, publisherPages, getPage, getPageCfi, getCachedPage };
}
