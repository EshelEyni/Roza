import { useEffect, useRef, useState } from "react";
import { useIntersection } from "react-use";

export function useIntersectionPagination() {
  const [paginationIdx, setPaginationIdx] = useState(1);
  const intersectionRef = useRef(null);
  const intersection = useIntersection(intersectionRef, {
    root: null,
    rootMargin: "0px",
    threshold: 0.5,
  });

  useEffect(() => {
    if (intersection && intersection.intersectionRatio > 0.1) {
      setPaginationIdx(i => i + 1);
    }
  }, [intersection]);

  return { paginationIdx, intersectionRef };
}
