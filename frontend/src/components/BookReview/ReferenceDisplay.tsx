import { FC } from "react";
import { Reference } from "../../../../shared/types/books";

type ReferenceEditProps = {
  reference: Reference;
  index: number;
};

export const ReferenceDisplay: FC<ReferenceEditProps> = ({ reference }) => {
  return (
    <div>
      <h2>{reference.id}</h2>
      {reference.imgs.map((img, idx) => (
        <div key={idx}>
          <img src={img} alt="reference" />
        </div>
      ))}
    </div>
  );
};
