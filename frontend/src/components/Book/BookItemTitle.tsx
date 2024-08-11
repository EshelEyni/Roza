import { FC } from "react";
import { useBook } from "../../contexts/BookContext";
import { GoBackBtn } from "../Buttons/GoBackBtn";
import { H2 } from "../App/H2";
import { Header } from "../App/Header";

export const BookItemTitle: FC = () => {
  const { pageTitle, onGoToDetails } = useBook();

  function handleTitleClick() {
    onGoToDetails({ isGoToRootPage: true });
  }

  return (
    <Header>
      <H2
        className="w-full cursor-pointer text-2xl font-bold text-app-900 hover:underline"
        onClick={handleTitleClick}
      >
        {pageTitle}
      </H2>
      <GoBackBtn />
    </Header>
  );
};
