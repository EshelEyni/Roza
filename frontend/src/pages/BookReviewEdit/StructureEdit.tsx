import { FC } from "react";
import { SlateCustomElement } from "../../../../shared/types/books";
import { SlateEditor } from "../../components/SlateTextEditor/TextEditor";
import { debounce, getDefaultSlateElement } from "../../services/utilService";
import { useTranslation } from "react-i18next";
import { useBookReview } from "../../contexts/ReviewContext";

type StructureEditProps = {
  structure: string;
};

export const StructureEdit: FC<StructureEditProps> = ({ structure }) => {
  const parsedText = structure
    ? (JSON.parse(structure) as SlateCustomElement[])
    : getDefaultSlateElement();
  const { t } = useTranslation();

  const { updateBookReviewEntity } = useBookReview();

  function handleChange(text: SlateCustomElement[]) {
    const updatedStructure = JSON.stringify(text);
    updateBookReviewEntity({
      type: "updateStructure",
      structure: updatedStructure,
    });
  }

  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold text-app-800">{t("structure")}</h2>

      <SlateEditor
        defaultValue={parsedText}
        onChange={debounce(value => handleChange(value), 500).debouncedFunc}
      />
    </div>
  );
};
