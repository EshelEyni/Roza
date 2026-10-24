/** Apply before serialization: Safari needs script-enabled frames for parent event listeners. */
export function protectReaderDocument(doc: Document) {
  const namespace = "http://www.w3.org/1999/xhtml";
  let head = doc.getElementsByTagName("head")[0];
  if (!head) {
    head = doc.createElementNS(namespace, "head") as HTMLHeadElement;
    doc.documentElement.insertBefore(head, doc.documentElement.firstChild);
  }
  // This is parsed before any book content. It blocks book scripts (including
  // inline handlers and javascript: URLs) while allowing parent-owned listeners.
  const policy = doc.createElementNS(namespace, "meta");
  policy.setAttribute("http-equiv", "Content-Security-Policy");
  policy.setAttribute(
    "content",
    "script-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'",
  );
  head.insertBefore(policy, head.firstChild);
  // Refresh navigation is not covered by script-src.
  for (const meta of Array.from(doc.getElementsByTagName("meta"))) {
    if (meta.getAttribute("http-equiv")?.toLowerCase() === "refresh") {
      meta.parentNode?.removeChild(meta);
    }
  }
}