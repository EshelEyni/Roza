import { FC } from "react";

type LogoProps = {
  className?: string;
};

export const Logo: FC<LogoProps> = ({
  className = "w-96 h-96 flex items-center justify-center",
}) => {
  return (
    <div className={className}>
      <img src="/images/android-chrome-512x512.png" alt="Loading..." />;
    </div>
  );
};
