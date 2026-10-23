import { Book, EpubCFI } from "epubjs";
import type Section from "epubjs/types/section";

export type PublisherPage = { label: string; cfi: string };

function check(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
}
function typeOf(element: Element) {
  return (
    element.getAttributeNS("http://www.idpf.org/2007/ops", "type") ||
    element.getAttribute("epub:type") ||
    ""
  ).split(/\s+/);
}

/** Keep publisher labels (including Roman numerals); never estimate print pagination. */
export async function loadPublisherPages(
  book: Book,
  signal: AbortSignal,
): Promise<PublisherPage[]> {
  check(signal);
  const navPath = book.packaging.navPath || book.packaging.ncxPath;
  const sections: Section[] = [];
  book.spine.each((section: Section) => sections.push(section));
  const documents = new Map<number, Document>();
  async function documentFor(section: Section) {
    check(signal);
    let doc = documents.get(section.index);
    if (!doc) {
      doc = (await book.load(section.url)) as Document;
      check(signal);
      documents.set(section.index, doc);
    }
    return doc;
  }
  const pages: PublisherPage[] = [];
  if (navPath) {
    const navUrl = new URL(book.resolve(navPath), "https://epub.invalid");
    const nav = (await book.load(navPath)) as Document;
    check(signal);
    const pageNav = Array.from(nav.getElementsByTagName("nav")).find(
      element =>
        typeOf(element).includes("page-list") ||
        element.getAttribute("role") === "doc-pagelist",
    );
    const references = pageNav
      ? Array.from(pageNav.getElementsByTagName("a"), anchor => ({
          href: anchor.getAttribute("href") || "",
          label: anchor.textContent?.trim() || "",
        }))
      : Array.from(nav.getElementsByTagName("pageTarget"), target => ({
          href:
            target.getElementsByTagName("content")[0]?.getAttribute("src") ||
            "",
          label:
            target.getElementsByTagName("text")[0]?.textContent?.trim() || "",
        }));
    for (const reference of references) {
      check(signal);
      if (!reference.href || !reference.label) continue;
      try {
        const url = new URL(reference.href, navUrl);
        if (url.origin !== navUrl.origin) continue;
        const fragment = decodeURIComponent(url.hash.slice(1));
        if (fragment.startsWith("epubcfi(")) {
          new EpubCFI(fragment);
          pages.push({ label: reference.label, cfi: fragment });
          continue;
        }
        const section = sections.find(
          item => new URL(item.url, navUrl).pathname === url.pathname,
        );
        if (!section) continue;
        const doc = await documentFor(section);
        const marker = fragment
          ? doc.getElementById(fragment)
          : doc.getElementsByTagName("body")[0];
        if (marker)
          pages.push({
            label: reference.label,
            cfi: section.cfiFromElement(marker),
          });
      } catch {
        check(signal);
        // A malformed target must not make the entire reader unavailable.
      }
    }
  }
  if (!pages.length) {
    // EPUBs sometimes retain pagebreak markers without a navigation page-list.
    for (const section of sections) {
      if (section.linear === false) continue;
      const doc = await documentFor(section);
      for (const marker of Array.from(doc.getElementsByTagName("*"))) {
        if (
          marker.getAttribute("role") !== "doc-pagebreak" &&
          !typeOf(marker).includes("pagebreak")
        )
          continue;
        const label = (
          marker.getAttribute("aria-label") ||
          marker.getAttribute("title") ||
          marker.textContent ||
          ""
        ).trim();
        if (label) pages.push({ label, cfi: section.cfiFromElement(marker) });
      }
    }
  }
  check(signal);
  const cfi = new EpubCFI();
  return pages
    .sort((a, b) => cfi.compare(a.cfi, b.cfi))
    .filter((page, index, all) => !index || page.cfi !== all[index - 1].cfi);
}

export function publisherPageAt(
  pages: PublisherPage[],
  location: string,
): PublisherPage | null {
  if (!location || !pages.length) return null;
  const cfi = new EpubCFI();
  let low = 0,
    high = pages.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (cfi.compare(pages[mid].cfi, location) <= 0) low = mid + 1;
    else high = mid;
  }
  return low ? pages[low - 1] : null;
}
