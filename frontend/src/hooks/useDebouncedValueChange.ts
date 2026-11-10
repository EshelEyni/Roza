import { useCallback, useEffect, useRef } from "react";

export function useDebouncedValueChange(onChange: (value: string) => void) {
  const callback = useRef(onChange);
  callback.current = onChange;
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const cancel = useCallback(() => clearTimeout(timer.current), []);
  useEffect(() => cancel, [cancel]);
  const schedule = useCallback((value: string) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => callback.current(value), 1500);
  }, []);
  return { schedule, cancel };
}