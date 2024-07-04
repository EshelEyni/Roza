import { FC } from "react";
import {
  Chapter,
  Character,
  Note,
  Plotline,
  Theme,
} from "../../../../shared/types/books";
import { BookDataPreview } from "./BookDataPreview";

type BookDataListProps = {
  data: Chapter[] | Character[] | Theme[] | Plotline[] | Note[];
  isRendered: boolean;
  type: "chapter" | "character" | "theme" | "plotline" | "note";
};

export const BookDataList: FC<BookDataListProps> = ({
  data,
  isRendered,
  type,
}) => {
  if (!isRendered) return null;

  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {data.map(d => (
        <li key={d.sortOrder}>
          <BookDataPreview dataItem={d} type={type} />
        </li>
      ))}
    </ul>
  );
};
