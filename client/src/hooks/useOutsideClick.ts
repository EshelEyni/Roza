import { useEffect, useRef, MutableRefObject } from "react";

type OutsideClickHandler = () => void;

type OutsideClickRef<T extends HTMLElement> = {
  outsideClickRef: MutableRefObject<T | null>;
};

export function useOutsideClick<T extends HTMLElement>(
  handler: OutsideClickHandler,
  listenCapturing = true,
  execludedElementIds = [] as string[],
): OutsideClickRef<T> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currId = (e?.target as any)?.id;
      if (execludedElementIds.includes(currId)) return;
      if (ref.current && !ref.current.contains(e.target as Node)) handler();
    }

    document.addEventListener("click", handleClick, listenCapturing);

    return () =>
      document.removeEventListener("click", handleClick, listenCapturing);
  }, [handler, listenCapturing, execludedElementIds]);

  return { outsideClickRef: ref };
}
