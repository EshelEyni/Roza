import { FC } from "react";

type MainProps = {
  children: React.ReactNode;
};

export const Main: FC<MainProps> = ({ children }) => {
  return (
    <main className="ui-main">
      {children}
    </main>
  );
};
