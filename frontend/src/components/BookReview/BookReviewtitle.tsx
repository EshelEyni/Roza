import { FC } from "react";
import { useBookReview } from "../../contexts/BookReviewContext";
import { PageTitle } from "../App/PageTitle";
import { useTranslation } from "react-i18next";

type ReviewTitleProps = {
  isEdit?: boolean;
};

export const BookReviewTitle: FC<ReviewTitleProps> = ({ isEdit = false }) => {
  const {
    bookReview,
    isSuccessBookReview,
    onNavigateToEdit,
    onArchiveBookReview,
    updateBookReview,
  } = useBookReview();

  const { t } = useTranslation();

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!bookReview) return;
    const name = e.target.value;
    updateBookReview({ ...bookReview, name });
  }
  if (!isSuccessBookReview || !bookReview) return null;
  return (
    <PageTitle
      isEdit={isEdit}
      entityName={bookReview.name}
      handleInputChange={handleInputChange}
      onNavigateToEdit={onNavigateToEdit}
      modalName="archiveReview"
      onDeleteEntity={onArchiveBookReview}
      archiveTitle={t("archiveReviewMsg.title")}
      archiveMsg={t("archiveReviewMsg.msg")}
    />
  );
};
