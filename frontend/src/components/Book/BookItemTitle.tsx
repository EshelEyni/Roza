import { FC } from "react";
import { useBook } from "../../contexts/BookContext";
import { GoBackBtn } from "../Buttons/GoBackBtn";

export const BookItemTitle: FC = () => {
  const { pageTitle, onGoToDetails } = useBook();

  return (
    <div className="flex w-full items-center justify-between gap-4">
      <h2
        className="w-full cursor-pointer text-2xl font-bold text-app-900 hover:underline"
        onClick={onGoToDetails}
      >
        {pageTitle}
      </h2>
      <GoBackBtn />
    </div>
  );
};
