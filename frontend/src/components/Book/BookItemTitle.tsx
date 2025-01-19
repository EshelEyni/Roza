import { FC } from "react";
import { useBook } from "../../contexts/BookContext";
import { GoBackBtn } from "../Buttons/GoBackBtn";
import { H2 } from "../App/H2";
import { H1 } from "../App/H1";

export const BookItemTitle: FC = () => {
  const { book, pageTitle, onGoToDetails } = useBook();

  function handleTitleClick() {
    onGoToDetails({ isGoToRootPage: true });
  }

  return (
    <header className="flex w-full flex-col items-center gap-4">
      <H1 onClick={handleTitleClick} addedClass="cursor-pointer">
        {book?.name}
      </H1>
      <div className="flex w-full items-center justify-between gap-4">
        <H2>{pageTitle}</H2>
        <GoBackBtn />
      </div>
    </header>
  );
};
