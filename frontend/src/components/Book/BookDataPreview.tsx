import { FC } from "react";
import {
  BooKDataItemType,
  Chapter,
  Character,
  Note,
  Plotline,
  Theme,
} from "../../../../shared/types/books";
import { useNavigate } from "react-router-dom";
import { useGetTitleTextBookItem } from "../../hooks/useGetTitleTextBookItem";

type BookDataPreviewProps = {
  dataItem: Chapter | Character | Theme | Plotline | Note;
  type: BooKDataItemType;
  isEdit?: boolean;
};

export const BookDataPreview: FC<BookDataPreviewProps> = ({
  dataItem,
  type,
  isEdit = false,
}) => {
  const navigate = useNavigate();
  const { getTitle, getText } = useGetTitleTextBookItem();

  const title = getTitle(dataItem, type);
  const text = getText(dataItem, type);

  function onOpenItem() {
    navigate(`${type}/${dataItem.id}`);
  }

  function onEditItem() {
    navigate(`/book-edit/${dataItem.bookId}/${type}/${dataItem.id}`);
  }

  function handlePreviewClick() {
    if (!isEdit) onOpenItem();
    else onEditItem();
  }

  return (
    <article
      onClick={handlePreviewClick}
      className="flex h-full max-h-[350px] flex-col gap-2 rounded-lg border border-app-900 p-3 shadow-lg transition duration-300 hover:scale-105 hover:shadow-xl"
    >
      <h2 className="mb-2 text-xl font-bold text-app-800">{title}</h2>
      <p className="overflow-y-auto text-app-900">{text}</p>
    </article>
  );
};
