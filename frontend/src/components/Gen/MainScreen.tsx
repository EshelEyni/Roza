import classnames from "classnames";

type MainScreenProps = {
  onClickFn: () => void;
  darkMode?: boolean;
};
export const MainScreen = ({
  onClickFn,
  darkMode = false,
}: MainScreenProps) => {
  return (
    <div
      className={classnames(
        "fixed left-0 top-0 z-[100] h-screen w-screen cursor-pointer",
        { "bg-gray-700 bg-opacity-80": darkMode },
        { "bg-transparent": !darkMode },
      )}
      onClick={onClickFn}
    ></div>
  );
};
