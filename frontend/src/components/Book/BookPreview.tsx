import { FC } from "react";
import { Book, BooKDataItemType } from "../../../../shared/types/books";
import { useTranslation } from "react-i18next";
import { formatDateByLang } from "../../services/utilService";
import { useLoginWithToken } from "../../hooks/reactQuery/get/useLoginWithToken";
import { useNavigate } from "react-router-dom";
import { Article } from "../App/Article";
import { H3 } from "../App/H3";

type BookPreviewProps = {
  book: Book;
};

export const BookPreview: FC<BookPreviewProps> = ({ book }) => {
  const { loggedInUser } = useLoginWithToken();
  const { t } = useTranslation();
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

  return (
    <Article onClick={handlePreviewClick}>
      <H3>{book.name}</H3>
      <ul className="flex flex-col gap-1 text-sm">
        <li className="flex gap-1 text-app-600">
          <span>{t("chapters")}:</span>
          <span>{getItemsLength("chapters")}</span>
        </li>
        <li className="flex gap-1 text-app-600">
          <span>{t("characters")}:</span>
          <span>{getItemsLength("characters")}</span>
        </li>
        <li className="flex gap-1 text-app-600">
          <span>{t("themes")}:</span>
          <span>{getItemsLength("themes")}</span>
        </li>
        <li className="flex gap-1 text-app-600">
          <span>{t("plotlines")}:</span>
          <span>{getItemsLength("plotlines")}</span>
        </li>
        <li className="flex gap-1 text-app-600">
          <span>{t("notes")}:</span>
          <span>{getItemsLength("notes")}</span>
        </li>
        <li className="flex flex-wrap gap-1 text-app-600">
          <span>{t("createdAt")}:</span>
          <span>{formattedDate}</span>
        </li>
      </ul>
    </Article>
  );
};
