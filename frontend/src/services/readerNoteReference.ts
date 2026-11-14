/** Recognize note links without treating ordinary numbers or mathematical superscripts as notes. */
export function readerNoteReference(node: Node): Element | null {
  for (
    let element = node.parentElement;
    element;
    element = element.parentElement
  ) {
    const type =
      element.getAttribute("epub:type") ||
      element.getAttributeNS("http://www.idpf.org/2007/ops", "type") ||
      "";
    if (
      type.split(/\s+/).includes("noteref") ||
      element.getAttribute("role")?.split(/\s+/).includes("doc-noteref")
    )
      return element;
    if (element.localName === "a") {
      const label = element.textContent?.trim() || "";
      const href = element.getAttribute("href") || "";
      if (
        href.includes("#") &&
        /^[\[\](\d\s)*†‡]+$/u.test(label) &&
        (element.closest("sup") ||
          element.querySelector("sup") ||
          /(?:footnote|endnote|noteref|fnref|(?:^|[/#_-])(?:fn|ftn)[_-]?\d|(?:^|[/#_-])notes?(?:[\d/_.#-]|$))/i.test(
            href + " " + element.className + " " + element.id,
          ))
      )
        return element;
    }
  }
  return null;
}
