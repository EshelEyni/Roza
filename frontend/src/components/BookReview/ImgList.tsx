import { FC } from "react";
import { ImgDisplay } from "./ImgDisplay";
import { Reference } from "../../../../shared/types/books";

type ImgListProps = {
  reference: Reference;
  imgs: string[];
};

export const ImgList: FC<ImgListProps> = ({ reference, imgs }) => {
  return (
    <ul className="flex flex-wrap gap-2">
      {imgs.map((img, index) => (
        <li key={index}>
          <ImgDisplay reference={reference} img={img} />
        </li>
      ))}
    </ul>
  );
};
