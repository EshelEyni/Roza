import { FC } from "react";
import { useBook } from "../../contexts/BookContext";
import { GoBackBtn } from "../Buttons/GoBackBtn";
import { H2 } from "../App/H2";

export const BookItemTitle: FC = () => {
  const { pageTitle, onGoToDetails } = useBook();

  function handleTitleClick() {
    onGoToDetails({ isGoToRootPage: true });
  }

  return (
    <div className="flex w-full items-center justify-between gap-4">
      <H2
        className="w-full cursor-pointer text-2xl font-bold text-app-900 hover:underline"
        onClick={handleTitleClick}
      >
        {pageTitle}
      </H2>
      <GoBackBtn />
    </div>
  );
};
