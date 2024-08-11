import { FC } from "react";
import { H2 } from "../App/H2";
import { useTranslation } from "react-i18next";
import { SlateCustomElement } from "../../../../shared/types/books";
import { TextElement } from "../App/TextElement";
import { getSlateElementText } from "../../services/utilService";

type StructureDisplayProps = {
  structure: SlateCustomElement[];
};

export const StructureDisplay: FC<StructureDisplayProps> = ({ structure }) => {
  const { t } = useTranslation();
  const text = getSlateElementText(structure);

  if (!text) return null;
  return (
    <section className="flex flex-col gap-2 text-app-800">
      <H2>{t("structure")}</H2>

      <>
        {structure.map((el, i) => (
          <TextElement key={i} element={el} />
        ))}
      </>
    </section>
  );
};
