import { FC } from "react";

type EmptyMsgProps = {
  msg: string;
};

export const EmptyMsg: FC<EmptyMsgProps> = ({ msg }) => {
  return <div className="text-3xl italic text-app-700 md:text-lg">{msg}</div>;
};
