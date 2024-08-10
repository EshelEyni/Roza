import { FC } from "react";

type PreviewContainerProps = {
  children: React.ReactNode;
};

export const PreviewContainer: FC<PreviewContainerProps> = ({ children }) => {
  return (
    <article className="h-full max-h-[350px] rounded-lg border border-app-900 p-4">
      {children}
    </article>
  );
};
