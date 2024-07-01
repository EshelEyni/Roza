import { FC } from "react";

type LoaderProps = {
  isPageLoader?: boolean;
};

export const Loader: FC<LoaderProps> = ({ isPageLoader = false }) => {
  if (isPageLoader)
    return (
      <div className="page-loader z-1000 fixed left-0 top-0 flex h-full w-full items-center justify-center bg-app-100 transition-all duration-300 ease-in-out">
        <span className="progress-bar" data-testid="progress-bar" />
        <img
          src="/images/android-chrome-512x512.png"
          alt="Loading..."
          className="h-96 w-96"
        />
      </div>
    );
  return <img src="/images/android-chrome-512x512.png" alt="Loading..." />;
};
