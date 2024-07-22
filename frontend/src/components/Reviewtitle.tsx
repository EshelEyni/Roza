import { FC } from "react";
import { useBookReview } from "../contexts/ReviewContext";
import { useUpdateBookReview } from "../hooks/reactQuery/update/updateReview";
import { PageTitle } from "./PageTitle";
import { useTranslation } from "react-i18next";

type ReviewtitleProps = {
  isEdit?: boolean;
};

export const Reviewtitle: FC<ReviewtitleProps> = ({ isEdit = false }) => {
  const { bookReview, isSuccessBookReview, onNavigateToEdit, onArchiveReview } =
    useBookReview();
  const { updateBookReview } = useUpdateBookReview();
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
      onDeleteEntity={onArchiveReview}
      archiveTitle={t("archiveReviewMsg.title")}
      archiveMsg={t("archiveReviewMsg.msg")}
    />
  );
};
