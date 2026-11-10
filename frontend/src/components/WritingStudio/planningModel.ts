import { Book, Chapter, StoryKind } from "../../../../shared/types/books";
export const storyKinds: StoryKind[] = ["characters", "themes", "plotlines"];
export const chapterTasks = (book: Book, id: string) =>
  (book.taskBoard?.lists || [])
    .flatMap(list => list.cards)
    .filter(card => card.chapterId === id);
export function matchesPlanning(book: Book, chapter: Chapter, filter: string) {
  if (!filter) return true;
  if (filter === "unfinished")
    return chapterTasks(book, chapter.id).some(t => !t.completed);
  const [kind, id] = filter.split(":");
  return (
    chapter.planning?.[kind as StoryKind]?.some(l => l.entityId === id) || false
  );
}
