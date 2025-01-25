import { FC } from "react";
import { Reference } from "../../../../shared/types/books";
import { TextElement } from "../App/TextElement";
import { MinimizedText } from "./MinimizedText";
import { useMinimized } from "../../hooks/useIsMinimized";
import { useBookReview } from "../../contexts/BookReviewContext";
import { ImgList } from "./ImgList";
import { BtnMinimize } from "../Buttons/BtnMinimize";
import { H3 } from "../App/H3";

type ReferenceEditProps = {
  reference: Reference;
};

export const ReferenceDisplay: FC<ReferenceEditProps> = ({ reference }) => {
  const { updateBookReviewEntity } = useBookReview();

  const { isMinimized, setIsMinimized } = useMinimized({
    isMinimizedProp: reference.isMinimized,
  });

  function onToggleMinimize() {
    setIsMinimized(!isMinimized);
    const updatedReference = {
      ...reference,
      isMinimized: !reference.isMinimized,
    };
    updateBookReviewEntity({
      type: "updateReference",
      reference: updatedReference,
    });
  }

  if (!reference) return null;

  return (
    <section>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <H3>{reference.pages}</H3>
          {isMinimized ? (
            <MinimizedText textEl={reference.text} maxLength={50} />
          ) : (
            <>
              {reference.text.map((el, i) => (
                <TextElement key={i} element={el} />
              ))}
            </>
          )}
        </div>
        <BtnMinimize
          isMinimized={reference.isMinimized}
          onToggleMinimize={onToggleMinimize}
        />
      </div>

      {!isMinimized && <ImgList reference={reference} imgs={reference.imgs} />}
    </section>
  );
};
