import { FC } from "react";
import { useParams } from "react-router-dom";

const BookEdit: FC = () => {
  const params = useParams();
  console.log(params);
  return <div>BoohEdit</div>;
};

export default BookEdit;
