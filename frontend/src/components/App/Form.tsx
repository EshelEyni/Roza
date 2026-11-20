import { FC } from "react";

type FormProps = {
  children: React.ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  className?: string;
};

export const Form: FC<FormProps> = ({
  children,
  onSubmit,
  className = "ui-form",
}) => {
  return (
    <form onSubmit={onSubmit} className={className}>
      {children}
    </form>
  );
};
