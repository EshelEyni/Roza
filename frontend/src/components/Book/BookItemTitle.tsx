import { FC } from "react";
import { useBook } from "../../contexts/BookContext";
import { GoBackBtn } from "../GoBackBtn";

export const BookItemTitle: FC = () => {
  const { pageTitle } = useBook();

  return (
    <div className="flex w-full items-center justify-between gap-4">
      <h2 className="w-full text-2xl font-bold text-app-900">{pageTitle}</h2>
      <GoBackBtn />
    </div>
  );
};
