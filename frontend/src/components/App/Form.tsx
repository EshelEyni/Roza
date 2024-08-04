import { FC } from "react";

type FormProps = {
  children: React.ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  className?: string;
};

export const Form: FC<FormProps> = ({
  children,
  onSubmit,
  className = "mt-5 rounded-lg bg-app-200 px-6 py-4 text-app-800 w-full flex flex-col gap-1",
}) => {
  return (
    <form onSubmit={onSubmit} className={className}>
      {children}
    </form>
  );
};
