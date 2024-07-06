import { FC } from "react";
import { useNavigate } from "react-router-dom";

type LogoProps = {
  className?: string;
  isLink?: boolean;
};

export const Logo: FC<LogoProps> = ({
  className = "w-96 h-96 flex items-center justify-center",
  isLink = false,
}) => {
  const navigate = useNavigate();
  function handleClick() {
    if (!isLink) return;
    navigate("/");
  }
  return (
    <div
      className={className}
      onClick={handleClick}
      style={{ cursor: isLink ? "pointer" : "default" }}
    >
      <img src="/images/android-chrome-512x512.png" alt="Loading..." />;
    </div>
  );
};
