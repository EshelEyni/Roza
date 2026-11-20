import { FC } from "react";

type PageContentProps = {
  children: React.ReactNode;
};

export const PageContent: FC<PageContentProps> = ({ children }) => {
  return (
    <section className="ui-page-content">
      {children}
    </section>
  );
};
