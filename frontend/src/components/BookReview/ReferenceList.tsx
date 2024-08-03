import { FC } from "react";
import { Reference } from "../../../../shared/types/books";
import { Hr } from "../../components/Gen/Hr";
import { Button } from "../../components/Buttons/Button";
import { useTranslation } from "react-i18next";
import { ReferenceEdit } from "./ReferenceEdit";
import { ReferenceDisplay } from "./ReferenceDisplay";
import { useBookReview } from "../../contexts/ReviewContext";
import { H2 } from "../Gen/H2";

type ReferenceListProps = {
  references: Reference[];
  isEdit?: boolean;
};

export const ReferenceList: FC<ReferenceListProps> = ({
  references,
  isEdit = false,
}) => {
  const { updateBookReviewEntity, onNavigateToEdit } = useBookReview();
  const { t } = useTranslation();

  function handleAddReference() {
    updateBookReviewEntity({ type: "addReference" });
    if (!isEdit) onNavigateToEdit();
  }

  return (
    <div className="w-full font-normal text-app-800">
      <div className="mb-1 flex items-center justify-between">
        <H2>{t("references")}</H2>
        <Button onClickFn={handleAddReference}>{t("btnAdd")}</Button>
      </div>

      <ul className="flex flex-col flex-wrap gap-2">
        {references.map((reference, i) => (
          <li key={reference.id}>
            {isEdit ? (
              <ReferenceEdit reference={reference} index={i} />
            ) : (
              <ReferenceDisplay reference={reference} index={i} />
            )}
            {i < references.length - 1 && <Hr />}
          </li>
        ))}
      </ul>
    </div>
  );
};
