import { useEffect, useState } from "react";

export const readerMobileQuery = "(max-width: 1024px)";

export function useReaderMobile(mediaQuery = readerMobileQuery) {
  const [mobile, setMobile] = useState(
    () => window.matchMedia(mediaQuery).matches,
  );
  useEffect(() => {
    const query = window.matchMedia(mediaQuery);
    const update = () => setMobile(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [mediaQuery]);
  return mobile;
}
