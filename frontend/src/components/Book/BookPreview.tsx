import { FC } from "react";
import { Book, BooKDataItemType } from "../../../../shared/types/books";
import { formatDateByLang } from "../../services/utilService";
import { useLoginWithToken } from "../../hooks/reactQuery/get/useLoginWithToken";
import { useNavigate } from "react-router-dom";
import { Article } from "../App/Article";
import { H3 } from "../App/H3";
import { ItemPreviewList } from "../App/ItemPreviewList";

type BookPreviewProps = {
  book: Book;
};

export const BookPreview: FC<BookPreviewProps> = ({ book }) => {
  const { loggedInUser } = useLoginWithToken();
  const formattedDate = book.createdAt
    ? formatDateByLang(book.createdAt, loggedInUser?.language || "en")
    : null;

  const navigate = useNavigate();

  function handlePreviewClick() {
    navigate(`/book/${book.id}`);
  }

  function getItemsLength(type: BooKDataItemType) {
    return book[type].length;
  }

  const list = [
    { label: "chapters", value: getItemsLength("chapters") },
    { label: "characters", value: getItemsLength("characters") },
    { label: "themes", value: getItemsLength("themes") },
    { label: "plotlines", value: getItemsLength("plotlines") },
    { label: "notes", value: getItemsLength("notes") },
    { label: "createdAt", value: formattedDate },
  ];

  return (
    <Article onClick={handlePreviewClick}>
      <H3>{book.name}</H3>
      <ItemPreviewList list={list} />
    </Article>
  );
};
