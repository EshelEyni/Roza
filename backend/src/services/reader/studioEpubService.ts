import AdmZip from "adm-zip";
import type {
  BookLanguage,
  BookPublishingRequest,
  SlateCustomElement,
  SlateCustomText,
} from "../../../../shared/types/books";
import { AppError } from "../error/errorService";

/** The manuscript fields the EPUB builder reads. */
export type StudioEpubChapter = {
  id: string;
  name: string;
  format?: "prose" | "screenplay";
  text: SlateCustomElement[];
};

export type StudioEpubCover = { media: "image/png" | "image/jpeg"; data: Buffer };

export type StudioEpubInput = {
  options: BookPublishingRequest;
  chapters: StudioEpubChapter[];
  cover?: StudioEpubCover;
  identifier: string;
  modified: Date;
};

const MAX_COVER_BYTES = 2 * 1024 * 1024;
const MAX_TITLE = 300;
const MAX_AUTHOR = 300;
const languages: BookLanguage[] = ["he", "en"];
const sceneBreak = /^(?:(?:\*\s*){3}|#|(?:~\s*){3})$/;

function escapeXml(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function plain(nodes: unknown): string {
  if (!Array.isArray(nodes)) return "";
  return nodes
    .map(node => {
      if (!node || typeof node !== "object") return "";
      const record = node as { text?: unknown; children?: unknown };
      return typeof record.text === "string" ? record.text : plain(record.children);
    })
    .join("");
}

/** Hebrew when Hebrew letters outnumber Latin letters in the manuscript. */
export function detectLanguage(chapters: Pick<StudioEpubChapter, "name" | "text">[]): BookLanguage {
  const sample = chapters.map(chapter => chapter.name + " " + plain(chapter.text)).join(" ");
  const hebrew = (sample.match(/[֐-׿]/g) || []).length;
  const latin = (sample.match(/[A-Za-z]/g) || []).length;
  return hebrew > latin ? "he" : "en";
}

export function chapterWordCount(chapter: Pick<StudioEpubChapter, "text">) {
  return plain(chapter.text).split(/\s+/).filter(Boolean).length;
}

function text(leaf: SlateCustomText): string {
  let html = escapeXml(typeof leaf.text === "string" ? leaf.text : "").replace(/\n/g, "<br/>");
  if (!html) return "";
  if (leaf.underline) html = `<span class="u">${html}</span>`;
  if (leaf.italic) html = `<em>${html}</em>`;
  if (leaf.bold) html = `<strong>${html}</strong>`;
  return html;
}

function inline(children: unknown): string {
  if (!Array.isArray(children)) return "";
  return children
    .map(child =>
      child && typeof child === "object" && "text" in child
        ? text(child as SlateCustomText)
        : inline((child as { children?: unknown })?.children),
    )
    .join("");
}

const alignments = ["left", "center", "right", "justify"];
function classes(...names: (string | false | undefined)[]) {
  const list = names.filter(Boolean);
  return list.length ? ` class="${list.join(" ")}"` : "";
}

const screenplayTypes = [
  "scene_heading",
  "action",
  "character",
  "dialogue",
  "parenthetical",
  "transition",
];

/** Turns manuscript blocks into XHTML. Every block gets a stable id for reader positions. */
export function renderBlocks(blocks: SlateCustomElement[]) {
  let index = 0;
  const id = () => ` id="b-${index++}"`;
  return blocks
    .map(block => {
      if (!block || typeof block !== "object") return "";
      const align =
        "align" in block && alignments.includes(String(block.align)) ? `align-${block.align}` : "";
      const content = inline(block.children);
      if (block.type === "bulleted-list" || block.type === "numbered-list") {
        const items = (Array.isArray(block.children) ? block.children : [])
          .map(item => `<li>${inline((item as { children?: unknown }).children)}</li>`)
          .join("");
        if (!items) return "";
        const tag = block.type === "bulleted-list" ? "ul" : "ol";
        return `<${tag}${id()}${classes(align)}>${items}</${tag}>`;
      }
      if (screenplayTypes.includes(block.type)) {
        if (!content) return "";
        return `<p${id()}${classes("sp", `sp-${block.type}`)}>${content}</p>`;
      }
      if (!content.replace(/<br\/>/g, "").trim()) return "";
      const raw = plain(block.children).trim();
      if (block.type === "paragraph" && sceneBreak.test(raw))
        return `<hr${id()} class="scene-break"/>`;
      if (block.type === "heading-one") return `<h2${id()}${classes(align)}>${content}</h2>`;
      if (block.type === "heading-two") return `<h3${id()}${classes(align)}>${content}</h3>`;
      if (block.type === "block-quote")
        return `<blockquote${id()}${classes(align)}><p>${content}</p></blockquote>`;
      return `<p${id()}${classes(align)}>${content}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}

function page(title: string, language: BookLanguage, body: string, type?: string) {
  const dir = language === "he" ? "rtl" : "ltr";
  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${language}" xml:lang="${language}" dir="${dir}">
<head>
<meta charset="UTF-8"/>
<title>${escapeXml(title)}</title>
<link rel="stylesheet" type="text/css" href="styles/book.css"/>
</head>
<body${type ? ` epub:type="${type}"` : ""}>
${body}
</body>
</html>
`;
}

const stylesheet = `body { margin: 0 5%; line-height: 1.6; }
h1 { font-size: 1.6em; margin: 2em 0 1.2em; text-align: center; font-weight: normal; }
h2 { font-size: 1.3em; margin: 1.4em 0 0.6em; }
h3 { font-size: 1.1em; margin: 1.2em 0 0.5em; }
p { margin: 0; text-indent: 1.5em; }
h1 + p, h2 + p, h3 + p, hr + p, blockquote + p, ul + p, ol + p { text-indent: 0; }
blockquote { margin: 1em 1.5em; font-style: italic; }
blockquote p { text-indent: 0; }
hr.scene-break { border: 0; margin: 1.2em 0; text-align: center; }
hr.scene-break::after { content: "* * *"; letter-spacing: 0.4em; }
.u { text-decoration: underline; }
.align-center { text-align: center; text-indent: 0; }
.align-right { text-align: right; text-indent: 0; }
.align-left { text-align: left; text-indent: 0; }
.align-justify { text-align: justify; }
.title-page { text-align: center; margin-top: 30%; }
.title-page h1 { font-size: 2em; margin: 0 0 1em; }
.title-page p { text-indent: 0; font-size: 1.1em; }
.cover { text-align: center; margin: 0; padding: 0; }
.cover img { max-width: 100%; max-height: 100%; }
nav ol { list-style: none; padding: 0; }
nav li { margin: 0.4em 0; }
.sp { text-indent: 0; font-family: "Courier New", Courier, monospace; }
.sp-scene_heading { text-transform: uppercase; font-weight: bold; margin-top: 1.2em; }
.sp-action { margin: 0.6em 0; }
.sp-character { text-transform: uppercase; margin: 0.8em 0 0 35%; }
.sp-parenthetical { margin: 0 0 0 28%; }
.sp-dialogue { margin: 0 15% 0.4em 20%; }
.sp-transition { text-transform: uppercase; text-align: end; margin: 0.8em 0; }
`;

/** Validates the dialog request and keeps only chapters that exist, in Studio order. */
export function parsePublishingRequest(
  body: unknown,
  chapters: Pick<StudioEpubChapter, "id">[],
): BookPublishingRequest {
  const value = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const title = typeof value.title === "string" ? value.title.trim() : "";
  if (!title || title.length > MAX_TITLE)
    throw new AppError(`Enter a title between 1 and ${MAX_TITLE} characters.`, 400);
  const author = typeof value.author === "string" ? value.author.trim() : "";
  if (author.length > MAX_AUTHOR)
    throw new AppError(`Keep the author under ${MAX_AUTHOR} characters.`, 400);
  if (!languages.includes(value.language as BookLanguage))
    throw new AppError("Choose Hebrew or English.", 400);
  if (!Array.isArray(value.chapterIds) || value.chapterIds.some(id => typeof id !== "string"))
    throw new AppError("Choose the chapters to include.", 400);
  const wanted = new Set(value.chapterIds as string[]);
  const chapterIds = chapters.map(chapter => chapter.id).filter(id => wanted.has(id));
  if (!chapterIds.length) throw new AppError("Choose at least one chapter.", 400);
  const cover = typeof value.cover === "string" ? value.cover : "";
  parseCover(cover);
  return {
    title,
    author,
    language: value.language as BookLanguage,
    includeTitlePage: value.includeTitlePage !== false,
    includeToc: value.includeToc !== false,
    chapterIds,
    cover,
  };
}

/** Accepts an empty string or a PNG/JPEG data URL of at most 2 MiB. */
export function parseCover(cover: string): StudioEpubCover | undefined {
  if (!cover) return undefined;
  const match = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+=*)$/.exec(cover);
  if (!match) throw new AppError("Use a PNG or JPEG cover image.", 400);
  const data = Buffer.from(match[2], "base64");
  if (!data.length || data.length > MAX_COVER_BYTES)
    throw new AppError("Use a cover image smaller than 2 MiB.", 400);
  const png = data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const jpeg = data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if ((match[1] === "image/png" && !png) || (match[1] === "image/jpeg" && !jpeg))
    throw new AppError("The cover image could not be read.", 400);
  return { media: match[1] as StudioEpubCover["media"], data };
}

/** Builds an EPUB 3 file with an EPUB 2 table of contents for older readers. */
export function buildStudioEpub({ options, chapters, cover, identifier, modified }: StudioEpubInput) {
  const included = chapters.filter(chapter => options.chapterIds.includes(chapter.id));
  if (!included.length) throw new AppError("Choose at least one chapter.", 400);
  const { language, title, author } = options;
  const dir = language === "he" ? "rtl" : "ltr";
  const zip = new AdmZip({ noSort: true });
  zip.addFile("mimetype", Buffer.from("application/epub+zip"));
  zip.getEntry("mimetype")!.header.method = 0;
  zip.addFile(
    "META-INF/container.xml",
    Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>
`),
  );

  type Item = { id: string; href: string; media: string; properties?: string; linear?: boolean };
  const manifest: Item[] = [
    { id: "nav", href: "nav.xhtml", media: "application/xhtml+xml", properties: "nav" },
    { id: "ncx", href: "toc.ncx", media: "application/x-dtbncx+xml" },
    { id: "css", href: "styles/book.css", media: "text/css" },
  ];
  const spine: Item[] = [];
  const add = (item: Item, content: string | Buffer, inSpine = true) => {
    zip.addFile("OEBPS/" + item.href, typeof content === "string" ? Buffer.from(content) : content);
    manifest.push(item);
    if (inSpine) spine.push(item);
  };
  zip.addFile("OEBPS/styles/book.css", Buffer.from(stylesheet));

  if (cover) {
    const extension = cover.media === "image/png" ? "png" : "jpg";
    add(
      { id: "cover-image", href: `images/cover.${extension}`, media: cover.media, properties: "cover-image" },
      cover.data,
      false,
    );
    add(
      { id: "cover", href: "cover.xhtml", media: "application/xhtml+xml" },
      page(title, language, `<section class="cover" epub:type="cover"><img src="images/cover.${extension}" alt="${escapeXml(title)}"/></section>`, "cover"),
    );
  }
  if (options.includeTitlePage)
    add(
      { id: "title-page", href: "title.xhtml", media: "application/xhtml+xml" },
      page(
        title,
        language,
        `<section class="title-page" epub:type="titlepage"><h1>${escapeXml(title)}</h1>${
          author ? `<p>${escapeXml(author)}</p>` : ""
        }</section>`,
      ),
    );

  const navEntries = included.map((chapter, index) => ({
    label: chapter.name.trim() || `${language === "he" ? "פרק" : "Chapter"} ${index + 1}`,
    href: `chapter-${chapter.id}.xhtml`,
  }));
  const navList = `<ol>${navEntries
    .map(entry => `<li><a href="${entry.href}">${escapeXml(entry.label)}</a></li>`)
    .join("")}</ol>`;
  const tocLabel = language === "he" ? "תוכן העניינים" : "Contents";
  zip.addFile(
    "OEBPS/nav.xhtml",
    Buffer.from(
      page(
        tocLabel,
        language,
        `<nav epub:type="toc" id="toc"${options.includeToc ? "" : ' hidden="hidden"'}><h1>${tocLabel}</h1>${navList}</nav>`,
      ),
    ),
  );
  if (options.includeToc) spine.push(manifest[0]);

  included.forEach((chapter, index) => {
    const label = navEntries[index].label;
    add(
      { id: `chapter-${chapter.id}`, href: navEntries[index].href, media: "application/xhtml+xml" },
      page(
        label,
        language,
        `<section epub:type="chapter"${chapter.format === "screenplay" ? ' class="screenplay"' : ""}><h1>${escapeXml(label)}</h1>\n${renderBlocks(chapter.text || [])}</section>`,
        "bodymatter",
      ),
    );
  });

  zip.addFile(
    "OEBPS/toc.ncx",
    Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="${language}">
<head><meta name="dtb:uid" content="${escapeXml(identifier)}"/></head>
<docTitle><text>${escapeXml(title)}</text></docTitle>
<navMap>${navEntries
      .map(
        (entry, index) =>
          `<navPoint id="np-${index + 1}" playOrder="${index + 1}"><navLabel><text>${escapeXml(entry.label)}</text></navLabel><content src="${entry.href}"/></navPoint>`,
      )
      .join("")}</navMap>
</ncx>
`),
  );

  const stamp = modified.toISOString().replace(/\.\d{3}Z$/, "Z");
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="${language}" dir="${dir}">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="book-id">${escapeXml(identifier)}</dc:identifier>
<dc:title>${escapeXml(title)}</dc:title>
${author ? `<dc:creator>${escapeXml(author)}</dc:creator>\n` : ""}<dc:language>${language}</dc:language>
<meta property="dcterms:modified">${stamp}</meta>
${cover ? '<meta name="cover" content="cover-image"/>\n' : ""}</metadata>
<manifest>
${manifest
  .map(
    item =>
      `<item id="${item.id}" href="${item.href}" media-type="${item.media}"${
        item.properties ? ` properties="${item.properties}"` : ""
      }/>`,
  )
  .join("\n")}
</manifest>
<spine toc="ncx" page-progression-direction="${dir}">
${spine.map(item => `<itemref idref="${item.id}"/>`).join("\n")}
</spine>
</package>
`;
  zip.addFile("OEBPS/content.opf", Buffer.from(opf));
  return zip.toBuffer();
}

export function epubFilename(title: string) {
  const base = title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").trim().slice(0, 120);
  return (base || "book") + ".epub";
}
