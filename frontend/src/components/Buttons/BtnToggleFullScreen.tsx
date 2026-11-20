import classNames from "classnames";
import { FC } from "react";
import { FaExpandArrowsAlt, FaCompressArrowsAlt } from "react-icons/fa";

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
      type="button"
      aria-label={isFullScreen ? "Exit full screen" : "Full screen"}
      className={classNames("ui-icon-btn", { "!text-2xl": isFullScreen })}
    >
      {isFullScreen ? <FaCompressArrowsAlt /> : <FaExpandArrowsAlt />}
    </button>
  );
};
