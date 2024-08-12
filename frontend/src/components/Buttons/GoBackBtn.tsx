import { FC } from "react";
import { FaArrowAltCircleLeft } from "react-icons/fa";
import { useOnGoBack } from "../../hooks/useOnGoBack";
import { Button } from "./Button";

export const GoBackBtn: FC = () => {
  const onGoBack = useOnGoBack();
  return (
    <Button
      onClick={onGoBack}
      className="text-[2.5rem] text-app-500 sm:text-5xl md:text-4xl"
    >
      <FaArrowAltCircleLeft />
    </Button>
  );
};
