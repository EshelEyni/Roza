import { useEffect } from "react";

export const DEFAULT_FAVICON = "/images/favicon.ico";
export const READER_FAVICON = "/images/reader-favicon.ico";

export function useFavicon(href: string) {
  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      link.type = "image/x-icon";
      document.head.appendChild(link);
    }
    link.href = href;
  }, [href]);
}
