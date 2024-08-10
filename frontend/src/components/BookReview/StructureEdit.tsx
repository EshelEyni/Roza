import { FC } from "react";
import { SlateCustomElement } from "../../../../shared/types/books";
import { SlateEditor } from "../SlateTextEditor/SlateEditor";
import { debounce } from "../../services/utilService";
import { useTranslation } from "react-i18next";
import { useBookReview } from "../../contexts/BookReviewContext";
import { H2 } from "../App/H2";
import { Hr } from "../App/Hr";

type StructureEditProps = {
  structure: SlateCustomElement[];
};

export const StructureEdit: FC<StructureEditProps> = ({ structure }) => {
  const { bookReview, updateBookReviewEntity } = useBookReview();
  const { t } = useTranslation();

  function handleChange(text: SlateCustomElement[]) {
    const updatedStructure = text;
    updateBookReviewEntity({
      type: "updateStructure",
      structure: updatedStructure,
    });
  }

  return (
    <>
      <Hr />
      <H2>{t("structure")}</H2>

      <SlateEditor
        initialValue={structure}
        onChange={debounce(value => handleChange(value), 500).debouncedFunc}
        fullScreenTitle={bookReview?.name || t("bookReview")}
      />
    </>
  );
};
