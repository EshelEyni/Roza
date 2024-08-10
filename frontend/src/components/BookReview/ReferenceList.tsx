import { FC } from "react";
import { Reference } from "../../../../shared/types/books";
import { Button } from "../../components/Buttons/Button";
import { useTranslation } from "react-i18next";
import { ReferenceEdit } from "./ReferenceEdit";
import { ReferenceDisplay } from "./ReferenceDisplay";
import { useBookReview } from "../../contexts/BookReviewContext";
import { H2 } from "../App/H2";
import { BtnMinimizeAll } from "../Buttons/BtnMinimizeAll";
import { DndListWrapper } from "../App/DndListWrapper";

type ReferenceListProps = {
  references: Reference[];
  isEdit?: boolean;
};

export const ReferenceList: FC<ReferenceListProps> = ({
  references,
  isEdit = false,
}) => {
  const {
    bookReview,
    updateBookReview,
    updateBookReviewEntity,
    onNavigateToEdit,
  } = useBookReview();
  const { t } = useTranslation();
  const isAllMinimized = references.every(r => r.isMinimized);

  function handleAddReference() {
    updateBookReviewEntity({ type: "addReference" });
    if (!isEdit) onNavigateToEdit();
  }

  function onToggleMinimize() {
    updateBookReviewEntity({
      type: "toggleMinimizeReferences",
      isMinimized: !isAllMinimized,
    });
  }

  function dragEndCallback(references: Reference[]) {
    if (!bookReview) return;
    updateBookReview({ ...bookReview, references });
  }

  return (
    <div className="w-full font-normal text-app-800">
      <div className="mb-1 flex items-center justify-between">
        <H2>{t("references")}</H2>

        <div className="flex items-center gap-2">
          <BtnMinimizeAll
            isMinimized={isAllMinimized}
            onToggleMinimize={onToggleMinimize}
          />
          <Button onClick={handleAddReference}>{t("btnAdd")}</Button>
        </div>
      </div>

      <DndListWrapper
        listClassName="flex flex-col gap-2"
        items={references}
        renderItem={(reference: Reference) =>
          isEdit ? (
            <ReferenceEdit reference={reference} />
          ) : (
            <ReferenceDisplay reference={reference} />
          )
        }
        dragEndCallback={dragEndCallback}
      />
    </div>
  );
};
