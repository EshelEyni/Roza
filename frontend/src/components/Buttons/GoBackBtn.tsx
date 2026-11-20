import { FC } from "react";
import { FaArrowAltCircleLeft } from "react-icons/fa";
import { useOnGoBack } from "../../hooks/useOnGoBack";
import { Button } from "./Button";

export const GoBackBtn: FC = () => {
  const onGoBack = useOnGoBack();
  return (
    <Button
      onClick={onGoBack}
      className="ui-icon-btn"
      ariaLabel="Go back"
    >
      <FaArrowAltCircleLeft />
    </Button>
  );
};
