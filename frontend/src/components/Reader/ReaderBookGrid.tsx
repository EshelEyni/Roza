import { useLayoutEffect, useRef } from "react";
import { ReaderBookMenu } from "./ReaderBookMenu";
import type { ReaderBook } from "../../../../shared/types/reader";
import { ReaderBookPreview } from "./ReaderBookPreview";

export function ReaderBookGrid({
  books,
  archived,
  pending,
  onArchive,
}: {
  books: ReaderBook[];
  archived: boolean;
  pending: boolean;
  onArchive: (book: ReaderBook) => void;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const positions = useRef(new Map<string, { left: number; top: number }>());
  useLayoutEffect(() => {
    const next = new Map<string, { left: number; top: number }>();
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    grid.current
      ?.querySelectorAll<HTMLElement>("[data-book-id]")
      .forEach((card) => {
        card.getAnimations().forEach((animation) => animation.cancel());
        const rect = card.getBoundingClientRect();
        const position = {
          left: rect.left + window.scrollX,
          top: rect.top + window.scrollY,
        };
        const id = card.dataset.bookId!;
        const previous = positions.current.get(id);
        next.set(id, position);
        if (
          previous &&
          !reduced &&
          (previous.left !== position.left || previous.top !== position.top)
        ) {
          card.animate(
            [
              {
                transform: `translate(${previous.left - position.left}px, ${previous.top - position.top}px)`,
              },
              { transform: "translate(0, 0)" },
            ],
            { duration: 320, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
          );
        }
      });
    positions.current = next;
  }, [books]);
  return (
    <div className="reader-book-grid" ref={grid}>
      {books.map((book) => (
        <div className="reader-book-item" data-book-id={book.id} key={book.id}>
          <ReaderBookPreview book={book} />
          <ReaderBookMenu book={book} archived={archived} pending={pending} onArchive={onArchive} />
        </div>
      ))}
    </div>
  );
}
