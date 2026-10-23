import { RefObject, useEffect, useRef, useState } from "react";
import ePub, { Location, Rendition } from "epubjs";
import Section from "epubjs/types/section";
import { ReaderPreferences } from "../../../shared/types/reader";

import {
  loadPublisherPages,
  PublisherPage,
} from "../services/readerPublisherPages";

type PageCount = { page: number; total: number };

/** Measure actual screen pages in a separate rendition, never seek the visible reader. */
export function useReaderPageCount(
  host: RefObject<HTMLDivElement>,
  file: ArrayBuffer | null,
  preferences: ReaderPreferences,
  location: Location | null,
  apply: (rendition: Rendition, preferences: ReaderPreferences) => void,
) {
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
    setCount(null);
    setPublisherPages(
      file && publisherCache.current?.file === file
        ? publisherCache.current.pages
        : null,
    );
    if (!file || !size.width || !size.height) return;
    const controller = new AbortController();
    let cancelled = false;
    let running = false;
    let pending = false;
    let pageTask: Promise<void> = Promise.resolve();
    const offsets = new Map<number, { offset: number; pages: number }>();
    let total = 0;
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
      visibility: "hidden",
      pointerEvents: "none",
    });
    document.body.append(container);
    // Own the archive and spine: the visible book may be destroyed on a flow change.
    const book = ePub({ replacements: "blobUrl" });
    let measuring: Rendition;
    const renderOptions = {
      width: size.width,
      height: size.height,
      spread: "none",
      flow: "paginated",
      manager: "default",
      allowScriptedContent: false,
      gap: 40,
    } as ConstructorParameters<typeof Rendition>[1];
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
    async function update() {
      if (running || cancelled) {
        pending = true;
        return;
      }
      running = true;
      do {
        pending = false;
        const current = latestLocation.current;
        if (!current) break;
        const section = offsets.get(current.start.index);
        if (!section) break;
        let page = current.start.displayed.page;
        if (preferences.flow === "scrolled") {
          await measuring.display(current.start.cfi);
          if (cancelled) return;
          page = (await getLocation()).start.displayed.page;
        }
        if (!cancelled)
          setCount({
            page: Math.min(
              total,
              section.offset + Math.min(section.pages, Math.max(1, page)),
            ),
            total,
          });
      } while (pending && !cancelled);
      running = false;
    }
    async function measure() {
      try {
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
          total += pages;
        }
        if (cancelled) return;
        updatePage.current = () => {
          pageTask = pageTask.then(update).catch(() => {
            if (!cancelled) setCount(null);
          });
        };
        await update();
        const pages =
          publisherCache.current?.file === file
            ? publisherCache.current.pages
            : await loadPublisherPages(book, controller.signal).catch(() => []);
        if (!cancelled) {
          publisherCache.current = { file: file!, pages };
          setPublisherPages(pages);
        }
      } catch {
        if (!cancelled) setCount(null);
      }
    }
    const measurement = measure();
    return () => {
      cancelled = true;
      controller.abort();
      updatePage.current = null;
      // Let in-flight EPUB rendering settle before destroying its manager.
      void Promise.allSettled([measurement, pageTask]).then(() => {
        book.destroy();
        container.remove();
      });
    };
  }, [file, size, preferences, apply]);

  useEffect(() => {
    updatePage.current?.();
  }, [location]);
  return { screen: count, publisherPages };
}
