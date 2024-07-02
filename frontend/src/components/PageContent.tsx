import { FC } from "react";

type PageContentProps = {
  children: React.ReactNode;
};

export const PageContent: FC<PageContentProps> = ({ children }) => {
  return (
    <section className="flex w-full max-w-[1000px] flex-col items-center justify-center gap-1 p-5">
      {children}
    </section>
  );
};
