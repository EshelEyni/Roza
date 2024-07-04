import { FC } from "react";
import "./BookLoader.scss";

type BookLoaderProps = {
  className?: string;
};

export const BookLoader: FC<BookLoaderProps> = ({
  className = "relative flex items-center justify-center w-48 h-48 mx-auto",
}) => {
  return (
    <div className={className}>
      <div className="book-loader">
        <div className="inner">
          <div className="left"></div>
          <div className="middle"></div>
          <div className="right"></div>
        </div>
        <ul>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
        </ul>
      </div>
    </div>
  );
};
