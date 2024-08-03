import classNames from "classnames";
import { FC } from "react";
import { FaExpandArrowsAlt } from "react-icons/fa";

type BtnToggleFullScreenProps = {
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
};

export const BtnToggleFullScreen: FC<BtnToggleFullScreenProps> = ({
  isFullScreen,
  onToggleFullScreen,
}) => {
  return (
    <button
      onClick={onToggleFullScreen}
      className={classNames("flex pt-[0.15rem] text-xl text-app-500", {
        "!pt-1 !text-3xl": isFullScreen,
      })}
    >
      {isFullScreen ? <FaExpandArrowsAlt /> : <FaExpandArrowsAlt />}
    </button>
  );
};
