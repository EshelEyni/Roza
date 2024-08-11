import { FC } from "react";
import { BookReview } from "../../../../shared/types/books";
import { useLoginWithToken } from "../../hooks/reactQuery/get/useLoginWithToken";
import { formatDateByLang } from "../../services/utilService";
import { useNavigate } from "react-router-dom";
import { Article } from "../App/Article";
import { H3 } from "../App/H3";
import { ItemPreviewList } from "../App/ItemPreviewList";

type ReviewPreviewProps = {
  review: BookReview;
};

export const BookReviewPreview: FC<ReviewPreviewProps> = ({ review }) => {
  const { loggedInUser } = useLoginWithToken();
  const formattedDate = review.createdAt
    ? formatDateByLang(review.createdAt, loggedInUser?.language || "en")
    : null;

  const navigate = useNavigate();

  function handlePreviewClick() {
    navigate(`/review/${review.id}`);
  }

  const list = [
    { label: "reviews", value: review.reviews.length },
    { label: "references", value: review.references.length },
    { label: "createdAt", value: formattedDate },
  ];

  return (
    <Article onClick={handlePreviewClick}>
      <H3>{review.name}</H3>
      <ItemPreviewList list={list} />
    </Article>
  );
};
