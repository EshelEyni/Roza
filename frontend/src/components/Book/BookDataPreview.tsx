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
import { H2 } from "../App/H2";
import { Article } from "../App/Article";
import { P } from "../App/P";

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
    <Article onClick={handlePreviewClick} addedClasses="max-h-[350px]">
      {title && <H2>{title}</H2>}
      <P addedClasses="overflow-y-auto h-full">{text}</P>
    </Article>
  );
};
