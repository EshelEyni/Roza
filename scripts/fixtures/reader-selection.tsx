// Browser fixture: production selection hooks and epub.js, without the API server.
import React, { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import ePub, { EpubCFI, type Contents, type Location } from "epubjs";
import JSZip from "jszip";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../../frontend/public/locales/en/translation.json";
import { useReaderSelection } from "../../frontend/src/hooks/reader/useReaderSelection";
import type { EpubRuntime } from "../../frontend/src/hooks/reader/useEpubRuntime";
import { bindReaderContents } from "../../frontend/src/services/bindReaderContents";
import { readSelectionRange } from "../../frontend/src/services/readerSelectionRange";
import { ReaderDictionary } from "../../frontend/src/components/Reader/ReaderDictionary";
import "../../frontend/src/styles/app/_reader.scss";

await i18next
  .use(initReactI18next)
  .init({ lng: "en", resources: { en: { translation: en } } });
const texts = Array.from({ length: 4 }, (_, chapter) =>
  Array.from({ length: 180 }, (_, word) => `chapter${chapter}word${word}`).join(
    " ",
  ),
);
const zip = new JSZip();
zip.file("mimetype", "application/epub+zip");
zip.file(
  "META-INF/container.xml",
  '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
);
zip.file(
  "book.opf",
  `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">selection-test</dc:identifier><dc:title>Selection test</dc:title><dc:language>en</dc:language></metadata><manifest>${texts.map((_, i) => `<item id="c${i}" href="c${i}.xhtml" media-type="application/xhtml+xml"/>`).join("")}</manifest><spine>${texts.map((_, i) => `<itemref idref="c${i}"/>`).join("")}</spine></package>`,
);
texts.forEach((text, index) =>
  zip.file(
    `c${index}.xhtml`,
    `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter ${index}</title></head><body><p>${text}</p></body></html>`,
  ),
);
const file = await zip.generateAsync({ type: "arraybuffer" });

function Fixture() {
  const selection = useReaderSelection();
  const latest = useRef(selection);
  latest.current = selection;
  const host = useRef<HTMLDivElement>(null);
  const runtime = useRef({
    host,
    renditionRef: { current: undefined },
    epubRef: { current: undefined },
    changingLayout: { current: false },
    mobileRef: { current: matchMedia("(max-width: 1024px)").matches },
    panelRef: { current: null },
    stateRef: { current: { preferences: { flow: "paginated" } } },
    selectionRef: { current: null },
  } as unknown as EpubRuntime);
  runtime.current.selectionRef.current = selection.textSelection;
  useEffect(() => {
    const book = ePub();
    const cleanups: (() => void)[] = [];
    async function start() {
      await book.open(file, "binary");
      await book.ready;
      const rendition = book.renderTo(host.current!, {
        width: "100%",
        height: 300,
        spread: "none",
        flow: "paginated",
        manager: "default",
        allowScriptedContent: true,
      });
      runtime.current.epubRef.current = book;
      runtime.current.renditionRef.current = rendition;
      rendition.hooks.content.register((contents: Contents) => {
        cleanups.push(
          bindReaderContents(
            contents,
            runtime.current,
            {
              onSelectionChange: (doc) => latest.current.onSelectionChange(doc),
              closeLookup: () => latest.current.closeLookup(),
              isExtending: () => latest.current.isExtending(),
              copySelection: (event) => latest.current.copySelection(event),
            },
            {
              onKey: () => {},
              enabled: () => true,
              move: (direction) => {
                latest.current.closeLookup();
                void rendition[direction]();
              },
              title: "Selection test",
              extend: (direction) =>
                latest.current.extend(runtime.current, direction),
            },
          ),
        );
      });
      rendition.on("selected", (cfi: string, contents: Contents) =>
        latest.current.select(cfi, contents),
      );
      rendition.on("relocated", () => {
        const nativeSelectionActive = (rendition.getContents() as unknown as Contents[])
          .some(contents => !!contents.document.getSelection()?.toString().trim());
        if (!latest.current.isExtending() && !nativeSelectionActive) latest.current.closeLookup();
      });
      await rendition.display();
      await rendition.reportLocation();
      const api = {
        book,
        rendition,
        texts,
        get selected() {
          return latest.current.textSelection;
        },
        get busy() {
          return latest.current.busy;
        },
        get extending() {
          return latest.current.extending;
        },
        close: () => latest.current.closeLookup(),
        extend: (direction: "next" | "prev") =>
          latest.current.extend(runtime.current, direction),
        read: (start: string, end: string) =>
          readSelectionRange(book, start, end),
        async display(index: number) {
          latest.current.closeLookup();
          await rendition.display(book.spine.get(index).href);
          await rendition.reportLocation();
        },
        select(start: number, end: number) {
          const contents = (
            rendition.getContents() as unknown as Contents[]
          )[0];
          const node = contents.document.querySelector("p")!.firstChild!;
          const range = contents.document.createRange();
          range.setStart(node, start);
          range.setEnd(node, end);
          const native = contents.document.getSelection()!;
          native.removeAllRanges();
          native.addRange(range);
          latest.current.select(contents.cfiFromRange(range), contents);
          return contents.cfiFromRange(range);
        },
        point(index: number, offset: number) {
          const section = book.spine.get(index);
          const doc = section.document;
          const range = doc.createRange();
          range.setStart(doc.querySelector("p")!.firstChild!, offset);
          range.collapse(true);
          return new EpubCFI(range, section.cfiBase).toString();
        },
        clipboard() {
          const contents = (
            rendition.getContents() as unknown as Contents[]
          )[0];
          const data = new DataTransfer();
          contents.document.dispatchEvent(
            new ClipboardEvent("copy", {
              clipboardData: data,
              cancelable: true,
            }),
          );
          return data.getData("text/plain");
        },
      };
      Object.assign(window, { selectionTest: api });
    }
    void start();
    return () => {
      cleanups.forEach((cleanup) => cleanup());
      book.destroy();
    };
  }, []);
  const location = runtime.current.renditionRef.current?.location as
    | Location
    | undefined;
  return (
    <div className="reader-shell reader-theme-light">
      <div ref={host} style={{ width: "100%", height: 300 }} />
      {selection.textSelection && (
        <ReaderDictionary
          key={selection.textSelection.cfi}
          selection={selection.textSelection}
          bookId="test"
          onClose={selection.closeLookup}
          onAskAi={() =>
            Object.assign(window, { askedText: selection.textSelection?.text })
          }
          aiDisabled={
            selection.busy || selection.textSelection.text.length > 20000
          }
          onExtend={(direction) => selection.extend(runtime.current, direction)}
          extending={selection.extending}
          busy={selection.busy}
          atStart={!!location?.atStart}
          atEnd={!!location?.atEnd}
        />
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
