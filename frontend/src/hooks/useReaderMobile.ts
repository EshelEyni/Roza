import { useEffect, useState } from "react";

export const readerMobileQuery = "(max-width: 1024px)";

export function useReaderMobile() {
  const [mobile, setMobile] = useState(
    () => window.matchMedia(readerMobileQuery).matches,
  );
  useEffect(() => {
    const query = window.matchMedia(readerMobileQuery);
    const update = () => setMobile(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return mobile;
}
