/** References are book-local; archived records retain links for safe recovery. */
type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid chapter planning record.");
  return value as RecordValue;
};
const records = (value: unknown): RecordValue[] => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("Invalid chapter planning collection.");
  return value.map(record);
};
export function validatePlanning(value: unknown, bookId: string): void {
  const book = record(value);
  const kinds = ["characters", "themes", "plotlines"];
  const id = (item: RecordValue) => String(item._id || item.id || "");
  const chapterIds = new Set(records(book.chapters).map(id));
  const libraries = Object.fromEntries(
    kinds.map(kind => [kind, new Set(records(book[kind]).map(id))]),
  );
  for (const kind of ["chapters", ...kinds, "notes"]) {
    const seen = new Set<string>();
    for (const item of records(book[kind])) {
      if (item.bookId && String(item.bookId) !== bookId)
        throw new Error("A manuscript item belongs to another book.");
      const key = id(item);
      if (key && seen.has(key)) throw new Error("Duplicate manuscript item.");
      seen.add(key);
    }
  }
  for (const chapter of records(book.chapters)) {
    if (chapter.planning === undefined) continue;
    const planning = record(chapter.planning);
    for (const kind of kinds) {
      const seen = new Set<string>();
      for (const link of records(planning[kind])) {
        if (typeof link.entityId !== "string" || !libraries[kind].has(link.entityId))
          throw new Error("A story element does not belong to this book.");
        if (seen.has(link.entityId)) throw new Error("Duplicate chapter association.");
        seen.add(link.entityId);
      }
    }
  }
  if (book.taskBoard !== undefined)
    for (const list of records(record(book.taskBoard).lists))
      for (const card of records(list.cards))
        if (card.chapterId && !chapterIds.has(String(card.chapterId)))
          throw new Error("A task chapter does not belong to this book.");
}
