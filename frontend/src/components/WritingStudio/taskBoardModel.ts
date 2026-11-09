import { TaskBoard } from "../../../../shared/types/books";
export const uid = () => crypto.randomUUID();
export const emptyBoard = (): TaskBoard => ({
  lists: ["To Do", "In Progress", "Done"].map((title) => ({
    id: uid(),
    title,
    cards: [],
  })),
});
export function moveTask(
  board: TaskBoard,
  active: string,
  over: string,
): TaskBoard {
  const next = structuredClone(board);
  const index = next.lists.findIndex((l) => l.id === active);
  if (index >= 0) {
    const target = next.lists.findIndex((l) => l.id === over);
    if (target >= 0)
      next.lists.splice(target, 0, ...next.lists.splice(index, 1));
    return next;
  }
  const source = next.lists.find((l) => l.cards.some((c) => c.id === active));
  const target = next.lists.find(
    (l) => l.id === over || l.cards.some((c) => c.id === over),
  );
  if (!source || !target || active === over) return next;
  const position = target.cards.findIndex((c) => c.id === over);
  const card = source.cards.splice(
    source.cards.findIndex((c) => c.id === active),
    1,
  )[0];
  card.updatedAt = new Date().toISOString();
  target.cards.splice(position < 0 ? target.cards.length : position, 0, card);
  return next;
}
