import { FC, useMemo, useState } from "react";
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
import { Article } from "../App/Article";
import { P } from "../App/P";
import { H3 } from "../App/H3";
import { useTranslation } from "react-i18next";
import { isChapterType } from "../../../../shared/services/utilService";
import { countWordsInSlateElements } from "../../services/wordCountService";

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
  const [isMinimized, setIsMinimized] = useState(true);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { getTitle, getText } = useGetTitleTextBookItem();

  const title = getTitle(dataItem, type);
  const text = getText(dataItem, type);
  const textToShow = isMinimized ? text.slice(0, 200) : text;

  const wordCount = useMemo(() => {
    if (!isChapterType(dataItem)) return null;
    return countWordsInSlateElements(dataItem.text);
  }, [dataItem]);

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

  function onShowMoreLessClick(e: React.MouseEvent) {
    e.stopPropagation();
    setIsMinimized(!isMinimized);
  }

  return (
    <Article onClick={handlePreviewClick}>
      {title && (
        <H3>
          {title}
          {wordCount !== null && (
            <span className="ms-1 text-lg">
              ({wordCount} {t("words")})
            </span>
          )}
        </H3>
      )}
      <P addedClassName="h-full">
        {textToShow}
        {text.length > 200 && (
          <span
            onClick={onShowMoreLessClick}
            className="z-10 ms-1 cursor-pointer text-app-500"
          >
            {isMinimized ? `...${t("showMore")}` : t("showLess")}
          </span>
        )}
      </P>
    </Article>
  );
};
