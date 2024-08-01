import { FC } from "react";
import { FaArrowAltCircleLeft } from "react-icons/fa";
import { useOnGoBack } from "../../hooks/useOnGoBack";
import { Button } from "./Button";

export const GoBackBtn: FC = () => {
  const onGoBack = useOnGoBack();
  return (
    <Button onClickFn={onGoBack} className="text-3xl text-app-500">
      <FaArrowAltCircleLeft />
    </Button>
  );
};
