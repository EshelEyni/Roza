/** Validate references inside one book; archived targets keep recoverable references. */
export function validatePlanning(book: Record<string, any>, bookId: string): void {
  const kinds = ["characters", "themes", "plotlines"];
  const id = (item: any) => String(item._id || item.id || "");
  const chapterIds = new Set((book.chapters || []).map(id));
  const libraries = Object.fromEntries(kinds.map(kind => [kind, new Set((book[kind] || []).map(id))]));
  for (const kind of ["chapters", ...kinds, "notes"]) {
    const seen = new Set<string>();
    for (const item of book[kind] || []) {
      if (item.bookId && String(item.bookId) !== bookId) throw new Error("A manuscript item belongs to another book.");
      const key = id(item);
      if (key && seen.has(key)) throw new Error("Duplicate manuscript item.");
      seen.add(key);
    }
  }
  for (const chapter of book.chapters || []) {
    if (!chapter.planning) continue;
    for (const kind of kinds) {
      const links = chapter.planning[kind] || [];
      if (!Array.isArray(links)) throw new Error("Invalid chapter planning.");
      const seen = new Set<string>();
      for (const link of links) {
        if (!libraries[kind].has(link.entityId)) throw new Error("A story element does not belong to this book.");
        if (seen.has(link.entityId)) throw new Error("Duplicate chapter association.");
        seen.add(link.entityId);
      }
    }
  }
  for (const list of book.taskBoard?.lists || [])
    for (const card of list.cards || [])
      if (card.chapterId && !chapterIds.has(card.chapterId)) throw new Error("A task chapter does not belong to this book.");
}
