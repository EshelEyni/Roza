import { FC } from "react";
import { Book, BooKDataItemType } from "../../../../shared/types/books";
import { useTranslation } from "react-i18next";
import { formatDateByLang } from "../../services/utilService";
import { useLoginWithToken } from "../../hooks/reactQuery/get/useLoginWithToken";
import { useNavigate } from "react-router-dom";
import { H2 } from "../Gen/H2";

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
    <article
      className="h-full cursor-pointer rounded-lg border border-app-800 bg-app-100 p-2 shadow-lg transition duration-300 hover:scale-105 hover:shadow-xl"
      onClick={handlePreviewClick}
    >
      <H2>{book.name}</H2>
      <ul className="flex flex-col gap-1 text-sm">
        <li className="flex gap-1 text-app-600">
          <span>{t("BookPreview.chapters")}:</span>
          <span>{getItemsLength("chapters")}</span>
        </li>
        <li className="flex gap-1 text-app-600">
          <span>{t("BookPreview.characters")}:</span>
          <span>{getItemsLength("characters")}</span>
        </li>
        <li className="flex gap-1 text-app-600">
          <span>{t("BookPreview.themes")}:</span>
          <span>{getItemsLength("themes")}</span>
        </li>
        <li className="flex gap-1 text-app-600">
          <span>{t("BookPreview.plotlines")}:</span>
          <span>{getItemsLength("plotlines")}</span>
        </li>
        <li className="flex gap-1 text-app-600">
          <span>{t("BookPreview.notes")}:</span>
          <span>{getItemsLength("notes")}</span>
        </li>
        <li className="flex flex-wrap gap-1 text-app-600">
          <span>{t("BookPreview.createdAt")}:</span>
          <span>{formattedDate}</span>
        </li>
      </ul>
    </article>
  );
};
