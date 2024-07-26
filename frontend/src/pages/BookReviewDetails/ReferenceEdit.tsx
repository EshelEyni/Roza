import { FC } from "react";
// import { useBookReview } from "../../contexts/ReviewContext";
import { Reference } from "../../../../shared/types/books";
import { ImgInput } from "./ImgInput";

type ReferenceEditProps = {
  reference: Reference;
};

export const ReferenceEdit: FC<ReferenceEditProps> = ({ reference }) => {
  //   const { updateBookReviewEntity } = useBookReview();

  return (
    <div>
      <h2>{reference.id}</h2>

      {reference.imgs.map((img, idx) => (
        <div key={idx}>
          <img src={img} alt="reference" />
        </div>
      ))}
      <ImgInput reference={reference} />
    </div>
  );
};
