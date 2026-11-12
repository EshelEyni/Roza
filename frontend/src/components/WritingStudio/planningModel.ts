import { emptyBoard } from "./taskBoardModel";
import { Book, Chapter, StoryKind, TaskBoard } from "../../../../shared/types/books";
export const storyKinds: StoryKind[] = ["characters", "themes", "plotlines"];
export function chapterBoard(book: Book, id: string): TaskBoard {
  const saved = book.chapters.find(c => c.id === id)?.taskBoard;
  if (saved) return saved;
  const lists = (book.taskBoard?.lists || []).map(list => ({ ...list, cards: list.cards.filter(card => card.chapterId === id) }));
  return lists.length ? structuredClone({ lists }) : emptyBoard();
}
export function withChapterBoard(book: Book, id: string, board: TaskBoard): Book {
  return { ...book, chapters: book.chapters.map(c => c.id === id ? { ...c, taskBoard: board } : c) };
}
export const chapterTasks = (book: Book, id: string) => chapterBoard(book, id).lists.flatMap(list => list.cards);
export function matchesPlanning(book: Book, chapter: Chapter, filter: string) {
  if (!filter) return true;
  if (filter === "unfinished")
    return chapterTasks(book, chapter.id).some(t => !t.completed);
  const [kind, id] = filter.split(":");
  return (
    chapter.planning?.[kind as StoryKind]?.some(l => l.entityId === id) || false
  );
}
