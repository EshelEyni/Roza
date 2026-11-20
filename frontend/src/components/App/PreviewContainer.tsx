import { FC } from "react";

type PreviewContainerProps = {
  children: React.ReactNode;
};

export const PreviewContainer: FC<PreviewContainerProps> = ({ children }) => {
  return (
    <article className="ui-card">
      {children}
    </article>
  );
};
