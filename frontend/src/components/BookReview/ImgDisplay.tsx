import { FC, useState } from "react";

type ImgDisplayProps = {
  img: string;
};

export const ImgDisplay: FC<ImgDisplayProps> = ({ img }) => {
  const [isOpened, setIsOpened] = useState(false);

  return (
    <>
      <div>
        <img
          src={img}
          alt="book reference"
          className="h-48 w-auto cursor-pointer rounded-2xl object-fill"
          onClick={() => setIsOpened(true)}
        />
      </div>
      {isOpened && (
        <img
          src={img}
          alt="book reference"
          className="fixed left-1/2 top-1/2 z-50 h-4/5  w-auto -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-2xl object-fill"
          onClick={() => setIsOpened(false)}
        />
      )}
    </>
  );
};
