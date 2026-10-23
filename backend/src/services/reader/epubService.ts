import AdmZip from "adm-zip";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import sanitizeHtml from "sanitize-html";
import path from "path";
import { AppError } from "../error/errorService";

const MAX_EPUB_SIZE = 25 * 1024 * 1024;
const MAX_EXPANDED_SIZE = 100 * 1024 * 1024;
const MAX_ENTRY_SIZE = 10 * 1024 * 1024;
const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  processEntities: false,
});
const contentPolicy =
  "default-src 'none'; img-src blob: data:; style-src 'unsafe-inline' blob:; font-src blob: data:; base-uri 'none'; form-action 'none';";

function asArray<T>(value: T | T[] | undefined): T[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value && typeof value === "object" && "#text" in value)
    return text((value as Record<string, unknown>)["#text"]);
  return "";
}

function resolveEntry(base: string, href: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(href.split("#")[0]);
  } catch {
    throw new AppError("Invalid EPUB resource path.", 400);
  }
  if (/^[a-z][a-z\d+.-]*:|^[/\\]|\\|\0/i.test(decoded))
    throw new AppError("External or unsafe EPUB resources are not supported.", 400);
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(base), decoded));
  if (resolved === ".." || resolved.startsWith("../"))
    throw new AppError("Invalid EPUB resource path.", 400);
  return resolved;
}

function cleanCss(css: string): string {
  // Remove escape/comment obfuscation before eliminating imports and resource loads.
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\\(?:[0-9a-f]{1,6}\s?|.)/gi, "")
    .replace(/@import[^;]*(;|$)/gi, "")
    .replace(/url\s*\([^)]*\)/gi, "none")
    .replace(/expression\s*\([^)]*\)/gi, "");
}

function cleanDocument(source: string): string {
  const body = sanitizeHtml(source, {
    allowedTags: [
      "html",
      "head",
      "title",
      "body",
      "link",
      "style",
      ...sanitizeHtml.defaults.allowedTags,
      "img",
      "figure",
      "figcaption",
      "section",
      "article",
      "nav",
      "aside",
      "header",
      "footer",
      "main",
      "hr",
      "br",
    ],
    allowedAttributes: {
      "*": ["id", "class", "lang", "dir", "title"],
      html: ["xmlns", "xmlns:epub", "lang", "dir"],
      a: ["href", "name"],
      img: ["src", "alt", "width", "height"],
      link: ["href", "rel", "type"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
    },
    allowedSchemes: [],
    allowProtocolRelative: false,
    allowVulnerableTags: true,
    transformTags: {
      // Common EPUB covers wrap a raster image in SVG. Keep the image without SVG active content.
      svg: () => ({ tagName: "div", attribs: {} }),
      image: (_tag, attributes) => ({
        tagName: "img",
        attribs: { src: attributes["xlink:href"] || attributes.href || "", alt: "" },
      }),
      style: (_tag, attributes) => ({ tagName: "style", attribs: attributes }),
      a: (_tag, attributes) => ({
        tagName: "a",
        attribs: {
          ...attributes,
          href: /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(attributes.href || "")
            ? ""
            : attributes.href || "",
        },
      }),
    },
    exclusiveFilter: frame => frame.tag === "link" && frame.attribs.rel !== "stylesheet",
  });
  const styled = body.replace(
    /<style\b[^>]*>([\s\S]*?)<\/style>/gi,
    (_match, css: string) => "<style>" + cleanCss(css) + "</style>",
  );
  const meta = '<meta http-equiv="Content-Security-Policy" content="' + contentPolicy + '"/>';
  const result = /<head[^>]*>/i.test(styled)
    ? styled.replace(/<head[^>]*>/i, match => match + meta)
    : '<html xmlns="http://www.w3.org/1999/xhtml"><head>' +
      meta +
      "</head><body>" +
      styled +
      "</body></html>";
  return result.replace(/<((?:img|br|hr|link))\b([^>]*?)(?:\s*\/)?\s*>/gi, "<$1$2 />");
}

function parseEpub(buffer: Buffer, filename: string) {
  if (!buffer.length || buffer.length > MAX_EPUB_SIZE)
    throw new AppError("Upload an EPUB smaller than 25 MiB.", 400);
  try {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    if (!entries.length || entries.length > 2000)
      throw new AppError("Too many EPUB resources.", 400);
    const names = new Set<string>();
    let expandedSize = 0;
    for (const entry of entries) {
      const name = entry.entryName;
      if (
        name.startsWith("/") ||
        name.includes("\\") ||
        name.split("/").includes("..") ||
        /^[a-z]:/i.test(name) ||
        names.has(name) ||
        entry.header.flags & 1
      )
        throw new AppError("Unsafe or encrypted EPUB archive.", 400);
      names.add(name);
      expandedSize += entry.header.size;
      if (entry.header.size > MAX_ENTRY_SIZE || expandedSize > MAX_EXPANDED_SIZE)
        throw new AppError("EPUB expands beyond the supported size.", 400);
    }
    if (zip.getEntry("META-INF/encryption.xml"))
      throw new AppError(
        "Encrypted EPUB resources are not supported. Upload a DRM-free EPUB.",
        400,
      );
    if (zip.readAsText("mimetype").trim() !== "application/epub+zip")
      throw new AppError("This file is not a valid EPUB.", 400);

    function readXml(name: string) {
      const entry = zip.getEntry(name);
      if (!entry) throw new AppError("EPUB resource is missing: " + name, 400);
      const source = entry.getData().toString("utf8");
      if (/<!DOCTYPE|<!ENTITY/i.test(source) || XMLValidator.validate(source) !== true)
        throw new AppError("Invalid EPUB XML.", 400);
      return parser.parse(source);
    }

    const container = readXml("META-INF/container.xml");
    const rootfile = asArray<Record<string, string>>(container.container?.rootfiles?.rootfile)[0];
    const opfPath = resolveEntry("container.xml", rootfile?.["@_full-path"] || "");
    const pkg = readXml(opfPath).package;
    if (!pkg?.manifest || !pkg?.spine) throw new AppError("EPUB has no readable content.", 400);
    const metas = asArray<Record<string, string>>(pkg.metadata?.meta);
    if (
      metas.some(
        meta => meta["@_property"] === "rendition:layout" && text(meta) === "pre-paginated",
      )
    )
      throw new AppError("Fixed-layout EPUBs are not supported yet.", 400);
    const items = asArray<Record<string, string>>(pkg.manifest.item);
    const spine = asArray<Record<string, string>>(pkg.spine.itemref);
    const resources = new Map<string, { name: string; media: string }>();
    for (const item of items) {
      const name = resolveEntry(opfPath, item["@_href"] || "");
      if (!zip.getEntry(name)) throw new AppError("EPUB is missing a declared resource.", 400);
      resources.set(item["@_id"], { name, media: item["@_media-type"] || "" });
    }
    if (
      !spine.length ||
      spine.some(item => resources.get(item["@_idref"])?.media !== "application/xhtml+xml")
    )
      throw new AppError("EPUB has an invalid reading order.", 400);

    const coverId = metas.find(meta => meta["@_name"] === "cover")?.["@_content"];
    const coverItem =
      items.find(item => (item["@_properties"] || "").split(" ").includes("cover-image")) ||
      items.find(item => item["@_id"] === coverId);
    const coverResource = coverItem && resources.get(coverItem["@_id"]);
    let cover = "";
    if (coverResource && /^image\/(png|jpeg|gif|webp)$/.test(coverResource.media)) {
      const image = zip.getEntry(coverResource.name)!;
      if (image.header.size <= 2 * 1024 * 1024)
        cover = "data:" + coverResource.media + ";base64," + image.getData().toString("base64");
    }

    // Sanitize every HTML/CSS archive member, including unlisted resources.
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const declared = Array.from(resources.values()).find(
        resource => resource.name === entry.entryName,
      );
      if (
        /\.(xhtml|html|htm)$/i.test(entry.entryName) ||
        declared?.media === "application/xhtml+xml"
      )
        zip.updateFile(
          entry.entryName,
          Buffer.from(cleanDocument(entry.getData().toString("utf8"))),
        );
      else if (/\.css$/i.test(entry.entryName) || declared?.media === "text/css")
        zip.updateFile(entry.entryName, Buffer.from(cleanCss(entry.getData().toString("utf8"))));
    }
    const title =
      text(asArray(pkg.metadata?.title)[0]).trim().slice(0, 300) ||
      filename
        .replace(/\.epub$/i, "")
        .replace(/[_-]/g, " ")
        .slice(0, 300) ||
      "Untitled book";
    const author = asArray(pkg.metadata?.creator)
      .map(text)
      .filter(Boolean)
      .join(", ")
      .slice(0, 500);
    return { title, author, cover, buffer: zip.toBuffer() };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("Could not read this EPUB. Check that it is a valid, DRM-free book.", 400);
  }
}

export { parseEpub, MAX_EPUB_SIZE };
