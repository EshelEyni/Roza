import { FC } from "react";
import { useBookReview } from "../../contexts/ReviewContext";
import { Reference, SlateCustomElement } from "../../../../shared/types/books";
import { ImgInput } from "./ImgInput";
import { useTranslation } from "react-i18next";
import { Hr } from "../Gen/Hr";
import { debounce } from "../../services/utilService";
import { SlateEditor } from "../SlateTextEditor/TextEditor";
import { ImgList } from "./ImgList";

type ReferenceEditProps = {
  reference: Reference;
};

export const ReferenceEdit: FC<ReferenceEditProps> = ({ reference }) => {
  const { updateBookReviewEntity } = useBookReview();
  const { t } = useTranslation();

  function handlePagesInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    updateBookReviewEntity({
      type: "updateReference",
      reference: { ...reference, pages: e.target.value },
    });
  }

  function handleTextChange(text: SlateCustomElement[]) {
    const updatedReference = { ...reference, text };
    updateBookReviewEntity({
      type: "updateReference",
      reference: updatedReference,
    });
  }

  if (!reference) return null;
  return (
    <div className="flex flex-col gap-3">
      <Hr />
      <input
        type="text"
        defaultValue={reference.pages}
        placeholder={t("pages")}
        className="w-full max-w-[200px] rounded-md border border-app-800 px-2 py-1"
        onChange={e =>
          debounce(e => handlePagesInputChange(e), 500).debouncedFunc(e)
        }
      />

      <SlateEditor
        defaultValue={reference.text}
        onChange={debounce(value => handleTextChange(value), 500).debouncedFunc}
      />

      <ImgInput reference={reference} />
      <ImgList imgs={reference.imgs} />
    </div>
  );
};
