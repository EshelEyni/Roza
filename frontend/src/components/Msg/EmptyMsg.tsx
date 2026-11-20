import { FC } from "react";

type EmptyMsgProps = {
  msg: string;
};

export const EmptyMsg: FC<EmptyMsgProps> = ({ msg }) => {
  return <div className="ui-empty">{msg}</div>;
};
