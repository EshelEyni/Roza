import { FC } from "react";
import { SlateCustomElement } from "../../../../shared/types/books";
import { SlateEditor } from "../../components/SlateTextEditor/TextEditor";
import { debounce } from "../../services/utilService";
import { useTranslation } from "react-i18next";
import { useBookReview } from "../../contexts/ReviewContext";

type StructureEditProps = {
  structure: SlateCustomElement[];
};

export const StructureEdit: FC<StructureEditProps> = ({ structure }) => {
  const { t } = useTranslation();

  const { updateBookReviewEntity } = useBookReview();

  function handleChange(text: SlateCustomElement[]) {
    const updatedStructure = text;
    updateBookReviewEntity({
      type: "updateStructure",
      structure: updatedStructure,
    });
  }

  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold text-app-800">{t("structure")}</h2>

      <SlateEditor
        defaultValue={structure}
        onChange={debounce(value => handleChange(value), 500).debouncedFunc}
      />
    </div>
  );
};
