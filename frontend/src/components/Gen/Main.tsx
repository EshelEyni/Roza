import { FC } from "react";

type MainProps = {
  children: React.ReactNode;
};

export const Main: FC<MainProps> = ({ children }) => {
  return (
    <main className="relative flex h-full w-full flex-col items-center bg-app-100">
      {children}
    </main>
  );
};
