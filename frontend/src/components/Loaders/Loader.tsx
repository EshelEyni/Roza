import { FC } from "react";
import { Logo } from "../App/Logo";

type LoaderProps = {
  isPageLoader?: boolean;
  className?: string;
};

export const Loader: FC<LoaderProps> = ({
  isPageLoader = false,
  className = "w-96 h-96 flex items-center justify-center mt-24 mx-auto",
}) => {
  if (isPageLoader)
    return (
      <div className="page-loader z-1000 fixed left-0 top-0 flex h-full w-full items-center justify-center bg-app-100 transition-all duration-300 ease-in-out">
        <span className="progress-bar" data-testid="progress-bar" />
        <Logo />
      </div>
    );
  return <Logo className={className} />;
};
