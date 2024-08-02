import { FC } from "react";
import { ImgDisplay } from "./ImgDisplay";

type ImgListProps = {
  imgs: string[];
};

export const ImgList: FC<ImgListProps> = ({ imgs }) => {
  return (
    <ul className="flex flex-wrap gap-2">
      {imgs.map((img, index) => (
        <li key={index}>
          <ImgDisplay img={img} />
        </li>
      ))}
    </ul>
  );
};
